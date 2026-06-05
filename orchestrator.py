import os
import sys
import time
import json
import signal
import asyncio
import zipfile
import subprocess
import urllib.request
import urllib.error
from collections import deque
from dataclasses import dataclass, field
from typing import List, Optional

# --- CONSTANTS & CONFIG ---
NGINX_URL = "https://nginx.org/download/nginx-1.24.0.zip"
BIN_DIR = os.path.join(os.getcwd(), "bin")
NGINX_DIR = os.path.join(BIN_DIR, "nginx-1.24.0")
NGINX_EXE = os.path.join(NGINX_DIR, "nginx.exe")
LOGS_DIR = os.path.join(os.getcwd(), "logs")
RESTARTS_LOG = os.path.join(LOGS_DIR, "restarts.jsonl")

os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(BIN_DIR, exist_ok=True)
os.makedirs(os.path.join(NGINX_DIR, "nginx_cache"), exist_ok=True) # For Nginx Micro-caching

# ANSI Colors for Terminal UI
COLORS = {
    "cyan": "\033[96m",
    "green": "\033[92m",
    "yellow": "\033[93m",
    "red": "\033[91m",
    "magenta": "\033[95m",
    "reset": "\033[0m",
    "clear_line": "\033[2K\r"
}

@dataclass
class ProcessConfig:
    name: str
    command: List[str]
    port: int
    color: str
    cwd: str = "."
    log_filter: List[str] = field(default_factory=list)
    is_shard: bool = False
    
    # State tracking
    process: Optional[subprocess.Popen] = None
    status: str = "starting" # starting, healthy, restarting, evicted
    consecutive_failures: int = 0
    crash_timestamps: deque = field(default_factory=lambda: deque(maxlen=5))

# Senior Dev Feature: Dataclass Configuration instead of magic strings
SERVICES = [
    ProcessConfig(
        name="Shard-1",
        command=[sys.executable, "-m", "uvicorn", "main:app", "--port", "8001"],
        port=8001,
        color="yellow",
        log_filter=["watchfiles", "Application startup complete", "Started server process", "Waiting for application startup"],
        is_shard=True
    ),
    ProcessConfig(
        name="Shard-2",
        command=[sys.executable, "-m", "uvicorn", "main:app", "--port", "8002"],
        port=8002,
        color="yellow",
        log_filter=["watchfiles", "Application startup complete", "Started server process", "Waiting for application startup"],
        is_shard=True
    ),
    ProcessConfig(
        name="Shard-3",
        command=[sys.executable, "-m", "uvicorn", "main:app", "--port", "8003"],
        port=8003,
        color="yellow",
        log_filter=["watchfiles", "Application startup complete", "Started server process", "Waiting for application startup"],
        is_shard=True
    ),
    ProcessConfig(
        name="Nginx",
        command=[NGINX_EXE, "-c", os.path.join(os.getcwd(), "nginx.conf"), "-p", NGINX_DIR],
        port=8000,
        color="green",
        log_filter=[]
    ),
    ProcessConfig(
        name="Frontend",
        command=["pnpm", "run", "dev"],
        port=5173,
        color="cyan",
        cwd="frontend",
        log_filter=["Vite server", "ready in", "page reload", "hmr update"]
    )
]

shutdown_flag = False
start_time = time.time()

# --- HELPER FUNCTIONS ---

def log(svc_name: str, color: str, msg: str):
    """Prints a color-coded log line, ensuring it respects the ANSI status bar."""
    sys.stdout.write(COLORS["clear_line"])
    c = COLORS.get(color, COLORS["reset"])
    print(f"{c}[{svc_name}] {COLORS['reset']}{msg}")

def download_nginx():
    """Auto-downloads Nginx on Windows so the orchestrator runs out of the box."""
    if not os.path.exists(NGINX_EXE):
        log("System", "magenta", "Downloading lightweight Nginx for Windows...")
        zip_path = os.path.join(BIN_DIR, "nginx.zip")
        urllib.request.urlretrieve(NGINX_URL, zip_path)
        log("System", "magenta", "Extracting Nginx...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(BIN_DIR)
        os.remove(zip_path)
        os.makedirs(os.path.join(NGINX_DIR, "nginx_cache"), exist_ok=True)
        log("System", "magenta", "Nginx ready!")

def spawn_process(svc: ProcessConfig):
    """Spawns a process and creates a daemon thread to tail and filter its logs."""
    use_shell = svc.name == "Frontend" # Windows requires shell=True for pnpm
    
    svc.process = subprocess.Popen(
        svc.command,
        cwd=svc.cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=use_shell
    )
    svc.status = "healthy"
    
    import threading
    def tail_logs():
        for line in svc.process.stdout:
            if shutdown_flag: break
            line = line.strip()
            if not line: continue
            # Noise-filtered log output
            if any(f in line for f in svc.log_filter): continue
            log(svc.name, svc.color, line)
            
    threading.Thread(target=tail_logs, daemon=True).start()

async def wait_for_port(port: int, name: str, timeout: int = 15):
    """Polls an endpoint until it returns a valid HTTP response."""
    log("System", "magenta", f"Waiting for {name} on port {port}...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            def ping():
                req = urllib.request.Request(f"http://127.0.0.1:{port}/equipment")
                with urllib.request.urlopen(req, timeout=1) as res:
                    return res.status
            status = await asyncio.to_thread(ping)
            if status in [200, 401, 403]:
                log("System", "magenta", f"{name} is UP!")
                return True
        except Exception:
            pass
        await asyncio.sleep(1)
    log("System", "red", f"Timeout waiting for {name} to boot.")
    return False

def audit_restart(svc: ProcessConfig, reason: str):
    """Structured restart audit log for zero-overhead postmortems."""
    with open(RESTARTS_LOG, "a") as f:
        f.write(json.dumps({
            "timestamp": time.time(),
            "service": svc.name,
            "port": svc.port,
            "reason": reason,
            "consecutive_failures": svc.consecutive_failures
        }) + "\n")

def hot_patch_nginx():
    """In-place Nginx upstream hot-patch on shard eviction (Zero Downtime)."""
    log("System", "magenta", "Hot-patching Nginx upstream pool...")
    conf_path = "nginx.conf"
    if not os.path.exists(conf_path): return
    
    with open(conf_path, "r") as f:
        lines = f.readlines()
        
    active_ports = [str(s.port) for s in SERVICES if s.is_shard and s.status != "evicted"]
    
    new_lines = []
    in_upstream = False
    for line in lines:
        if "upstream ecotech_backend" in line:
            in_upstream = True
            new_lines.append(line)
            for port in active_ports:
                new_lines.append(f"        server 127.0.0.1:{port};\n")
            continue
        if in_upstream:
            if "}" in line:
                in_upstream = False
                new_lines.append(line)
            continue # Skip old servers
        new_lines.append(line)
        
    with open(conf_path, "w") as f:
        f.writelines(new_lines)
        
    subprocess.run([NGINX_EXE, "-s", "reload", "-p", NGINX_DIR], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log("System", "green", "Nginx reloaded dynamically with active shards only.")

async def health_check_loop():
    """Mini-Kubernetes Control Plane: Monitors health and auto-restarts failed shards."""
    global shutdown_flag
    while not shutdown_flag:
        for svc in SERVICES:
            if not svc.is_shard or svc.status == "evicted": continue
            
            try:
                def do_ping():
                    req = urllib.request.Request(f"http://127.0.0.1:{svc.port}/equipment")
                    with urllib.request.urlopen(req, timeout=3.0) as res:
                        return res.status
                status_code = await asyncio.to_thread(do_ping)
                if status_code < 500:
                    svc.consecutive_failures = 0
                    svc.status = "healthy"
                    continue
                reason = f"500 Internal Server Error"
            except urllib.error.HTTPError as e:
                if e.code < 500:
                    svc.consecutive_failures = 0
                    svc.status = "healthy"
                    continue
                reason = f"HTTP {e.code} Error"
            except Exception:
                reason = "Connection Refused/Timeout"
            
            # Failure detected!
            svc.consecutive_failures += 1
            svc.status = "restarting"
            now = time.time()
            svc.crash_timestamps.append(now)
            
            audit_restart(svc, reason)
            log("System", "red", f"{svc.name} FAILED ({reason}). Consec failures: {svc.consecutive_failures}")
            
            # Crash-loop circuit breaker
            if len(svc.crash_timestamps) == 5 and (now - svc.crash_timestamps[0] < 60):
                svc.status = "evicted"
                log("System", "red", f"CIRCUIT BREAKER OPEN for {svc.name}! Evicting from pool.")
                hot_patch_nginx()
                continue
            
            # Exponential Backoff
            delay = 0 if svc.consecutive_failures == 1 else min(2 ** svc.consecutive_failures, 30)
            if delay > 0:
                log("System", "yellow", f"Backing off {delay}s before restarting {svc.name}...")
                await asyncio.sleep(delay)
            
            # Restart
            if svc.process:
                svc.process.terminate()
            log("System", "yellow", f"Restarting {svc.name}...")
            spawn_process(svc)
        
        await asyncio.sleep(5)

def render_status_bar():
    uptime = int(time.time() - start_time)
    bar = f"{COLORS['magenta']}[UPTIME: {uptime}s]{COLORS['reset']} "
    
    for svc in SERVICES:
        if svc.status == "healthy":
            c = COLORS["green"]
            sym = "●"
        elif svc.status == "starting":
            c = COLORS["cyan"]
            sym = "○"
        elif svc.status == "restarting":
            c = COLORS["yellow"]
            sym = "↻"
        else:
            c = COLORS["red"]
            sym = "⨯"
        
        fails = f"({svc.consecutive_failures})" if svc.consecutive_failures > 0 else ""
        bar += f"{c}{sym} {svc.name}{fails}{COLORS['reset']} "
        
    sys.stdout.write(COLORS["clear_line"] + bar)
    sys.stdout.flush()

async def status_bar_loop():
    while not shutdown_flag:
        render_status_bar()
        await asyncio.sleep(1)

def shutdown_handler(sig, frame):
    """Graceful shutdown on SIGINT / SIGTERM"""
    global shutdown_flag
    if shutdown_flag: return
    shutdown_flag = True
    
    print("\n")
    log("System", "red", "Initiating Graceful Shutdown...")
    
    for svc in SERVICES:
        if svc.process:
            log("System", "yellow", f"Sending SIGTERM to {svc.name}...")
            if svc.name == "Nginx":
                subprocess.run([NGINX_EXE, "-s", "quit", "-p", NGINX_DIR])
            else:
                svc.process.terminate()
    
    log("System", "red", "Waiting 3 seconds for graceful exit...")
    time.sleep(3)
    
    for svc in SERVICES:
        if svc.process and svc.process.poll() is None:
            log("System", "red", f"Force killing {svc.name}...")
            svc.process.kill()
            
    log("System", "green", "All processes terminated cleanly.")
    sys.exit(0)

async def main():
    # Register graceful shutdown hooks
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    
    log("System", "cyan", "Initializing Custom Mini-Kubernetes Orchestrator...")
    download_nginx()
    
    # Strict Boot Order: 1. Shards
    for svc in SERVICES:
        if svc.is_shard:
            spawn_process(svc)
            
    # Strict Boot Order: 2. Wait for Shards to return 200 OK
    for svc in SERVICES:
        if svc.is_shard:
            await wait_for_port(svc.port, svc.name)
            
    # Strict Boot Order: 3. Nginx Load Balancer
    nginx_svc = next(s for s in SERVICES if s.name == "Nginx")
    spawn_process(nginx_svc)
    
    # Strict Boot Order: 4. Frontend React App
    vite_svc = next(s for s in SERVICES if s.name == "Frontend")
    spawn_process(vite_svc)
    
    log("System", "green", "Orchestrator successfully booted all microservices!")
    
    asyncio.create_task(health_check_loop())
    await status_bar_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
