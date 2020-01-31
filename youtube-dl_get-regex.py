from __future__ import unicode_literals;
import json, re, sys;
sys.path.insert(0, './youtube-dl')
from youtube_dl import extractor;
dict = extractor.__dict__.items()
for name, cls in dict:
    if isinstance(cls, type):
        if hasattr(cls, '_VALID_URL'):
            regex = re.compile(re.sub(r'(?<!\\)((\\{2})*)\s+', "\\1", re.sub(r'(?<!\\)((\\{2})*)# .*$(?m)', "\\1", cls._VALID_URL))).pattern
            print(json.dumps([name, regex, []]))
