# Stack path parser
FullPath -> "/yapp" StackpathEntry:+ {% d => d[1].map(n => n[0]) %}
StackpathEntry -> ModelSegment | UtilitySegment
ModelSegment -> "/" NamedItem "/" Uuid {% d => { return { name: d[1], id: d[3] } } %}
UtilitySegment -> "/" NamedItem {% d => { return { name: d[1] } } %}
NamedItem -> [a-z-]:+ {% d => d[0].join('') %}
Uuid -> Hex Hex Hex Hex Hex Hex Hex Hex "-" Hex Hex Hex Hex "-4" Hex Hex Hex "-" Hex Hex Hex Hex "-" Hex Hex Hex Hex Hex Hex Hex Hex Hex Hex Hex Hex {% d => d.join('') %}
Hex -> [a-f0-9] {% id %}
