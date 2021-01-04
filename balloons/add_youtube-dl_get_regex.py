from __future__ import unicode_literals
import json, re, sys;
sys.path.insert(0, '../youtube-dl')
from youtube_dl import extractor
extractors = extractor.__dict__.items()
for name, cls in extractors:
    if isinstance(cls, type) and hasattr(cls, '_VALID_URL'):
        regex = re.sub(r'(?<!\\)((\\{2})*)# .*$(?m)', "\\1", cls._VALID_URL)
        regex = re.sub(r'(?<!\\)((\\{2})*)\s+', "\\1", regex)
        regex = re.compile(regex).pattern
        print(json.dumps([name, regex, []]))
