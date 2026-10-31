"""Browser compatibility for numerical-only RayTracing/RayOptics use.

Vendor numerical code is unchanged. Desktop plotting, native process pools and
native networking are deliberately unavailable; the demo calls none of them.
"""
import sys
import types


def unsupported(*args, **kwargs):
    raise NotImplementedError("Desktop plotting/process/network APIs are not part of this browser demo")


plotting = types.ModuleType("matplotlib")
plotting.__path__ = []
pyplot = types.ModuleType("matplotlib.pyplot")
for name in ["ioff", "subplots", "subplots_adjust", "show"]:
    setattr(pyplot, name, unsupported)
plotting.pyplot = pyplot
sys.modules["matplotlib"] = plotting
sys.modules["matplotlib.pyplot"] = pyplot

try:
    import multiprocessing
except ImportError:
    processes = types.ModuleType("multiprocessing")
    processes.cpu_count = lambda: 1
    processes.Pool = unsupported
    sys.modules["multiprocessing"] = processes

try:
    import ssl
except ImportError:
    network = types.ModuleType("ssl")
    network.SSLError = OSError
    sys.modules["ssl"] = network

sys.path.insert(0, "/optics")
import json
from optics import calculate
