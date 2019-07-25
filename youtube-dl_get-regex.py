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
#dict = extractor.__dict__.items()
#if isinstance(cls, type) if hasattr(cls, '_VALID_URL')]

#for name, cls in dict
    #print regex, name
    #comp = re.compile(regex)
    #print comp.pattern
    #uvregex = comp.pattern
    #if comp.flags == re.X | comp.flags == (re.X + re.I):
#uvregex = comp.match('r^\(?x\)(.+)')
    #if uvregex:
    #print name
    #uvregex = unverbosify_regex(comp.pattern)
    #print regex
    #re.compile(uvregex)

#print re.compile(dict['OpenloadIE']).pattern
