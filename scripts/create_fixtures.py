import pathlib
import subprocess
import sys
root=pathlib.Path(__file__).resolve().parents[1]
for name in ["create_fixture.py","create_federation_fixture.py"]:
    subprocess.run([sys.executable,str(root/"workers/bim/scripts"/name)],cwd=root,check=True)
