import sys
import os
import time
import subprocess

# Ensure the root directory is in the PYTHONPATH so we can import 'orchestration'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def get_mtimes():
    """Scans for all Python files and gets their last-modified timestamps."""
    mtimes = {}
    for root, _, files in os.walk(os.path.dirname(os.path.abspath(__file__))):
        # Ignore frontend and cache directories (React handles its own hot-reloading)
        if "node_modules" in root or ".git" in root or "__pycache__" in root or "frontend" in root:
            continue
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                mtimes[path] = os.stat(path).st_mtime
    return mtimes

def run_server():
    from orchestration import k8s_web
    import asyncio
    try:
        asyncio.run(k8s_web.main())
    except KeyboardInterrupt:
        pass

def start_reloader():
    """Spawns the server in a subprocess and restarts it when a file changes."""
    print("🚀 Starting auto-reloader for EcoTech Backends...")
    mtimes = get_mtimes()
    
    while True:
        env = os.environ.copy()
        env["IS_CHILD_PROCESS"] = "true"
        # Launch ourselves as a child process
        process = subprocess.Popen([sys.executable, __file__], env=env)
        
        try:
            while True:
                time.sleep(1)
                # Check if any python file has changed
                new_mtimes = get_mtimes()
                if new_mtimes != mtimes:
                    print("\n♻️ Python file change detected! Restarting backend servers...")
                    mtimes = new_mtimes
                    process.terminate() # Gracefully stop all shards and nginx
                    process.wait()
                    break # Break out to restart the loop
                    
                # If the child process crashed or died on its own, stop the loop
                if process.poll() is not None:
                    break
        except KeyboardInterrupt:
            process.terminate()
            break

if __name__ == "__main__":
    # If we are the child process, actually run the K8s Orchestration logic
    if os.environ.get("IS_CHILD_PROCESS"):
        run_server()
    else:
        # Otherwise, run the watcher
        start_reloader()