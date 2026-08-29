#!/usr/bin/env python3
"""Cloudera AI Workbench Application script. Kernel: Python 3."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
script = ROOT / "scripts" / "cloudera-start.sh"
sys.exit(subprocess.call(["bash", str(script)]))
