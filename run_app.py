import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestration import k8s_app

if __name__ == "__main__":
    try:
        asyncio.run(k8s_app.main())
    except KeyboardInterrupt:
        pass
