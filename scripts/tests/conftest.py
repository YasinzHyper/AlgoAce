import sys
from pathlib import Path

# The scripts are plain files, not a package: make them importable by name.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
