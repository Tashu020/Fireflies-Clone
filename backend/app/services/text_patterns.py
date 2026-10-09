"""Shared word lists and regular expressions for the heuristic summarizer and Smart Search."""

import re

STOPWORDS = frozenset(
    """
    a about above after again against all almost also am an and any are aren't around as at
    be because been before being below between both but by can can't cannot could couldn't
    did didn't do does doesn't doing don't down during each either else even ever every few
    for from further get gets getting go goes going gone got gotta had hadn't has hasn't have
    haven't having he he'd he'll he's her here here's hers herself him himself his how how's
    i i'd i'll i'm i've if in into is isn't it it's its itself just let let's like likely lot
    lots made make makes making many may maybe me might mine more most much must mustn't my
    myself need needs no nor not now of off often okay ok on once one only or other ought our
    ours ourselves out over own perhaps please pretty quite rather really right said same say
    says see seems shall shan't she she'd she'll she's should shouldn't so some something
    sometimes still such sure take than thank thanks that that's the their theirs them
    themselves then there there's these they they'd they'll they're they've thing things think
    this those though through to too toward under until up upon us use used using very via
    want wanted wants was wasn't way we we'd we'll we're we've well were weren't what what's
    when when's where where's whether which while who who's whom why why's will with within
    without won't would wouldn't yeah yes yet you you'd you'll you're you've your yours
    yourself yourselves actually basically definitely honestly great good sounds sound thing
    kind sort bit quick quickly today tomorrow yesterday week weeks next last first second
    third everyone everybody anyone someone guys hey hi hello morning afternoon evening
    doing done talk talking said tell told know knew known look looking looks mean means
    start started call called work works working give gave come came back time times great
    anything everything nothing able around zero two three four five six seven eight nine ten
    eleven twelve twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million
    percent half couple another always never
    """.split()  # noqa: SIM905 - a word block is easier to read and edit than a list
)

WORD = re.compile(r"[A-Za-z][A-Za-z0-9'’-]*")

# Phrases that usually introduce a commitment or a request.
ACTION_CUE = re.compile(
    r"\b(?:i'll|i will|i'm going to|we'll|we will|we need to|we should|we have to|let's|"
    r"can you|could you|would you|please|follow up|follow-up|to do|todo|"
    r"make sure|i can (?:take|handle|own|send|do)|will (?:send|share|prepare|draft|write|"
    r"review|schedule|set up|update|follow))\b|\baction items?:",
    re.IGNORECASE,
)

_WEEKDAYS = r"monday|tuesday|wednesday|thursday|friday|saturday|sunday"
_MONTHS = r"january|february|march|april|may|june|july|august|september|october|november|december"
DATE_TIME = re.compile(
    rf"\b(?:{_WEEKDAYS}|{_MONTHS}|today|tomorrow|yesterday|tonight|next (?:week|month|quarter)|"
    r"this (?:week|month|quarter)|end of (?:the )?(?:day|week|month|quarter|year)|"
    r"q[1-4]|\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}:\d{2}|mid (?:november|december|january))\b",
    re.IGNORECASE,
)

_NUMBER_WORDS = (
    r"zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|"
    r"fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|"
    r"eighty|ninety|hundred|thousand|million|billion|half|dozen"
)
_UNITS = (
    r"percent|%|dollars?|euros?|points?|seats?|days?|hours?|minutes?|weeks?|months?|years?|"
    r"rows?|tickets?|customers?|users?|leads?|accounts?|agents?|deals?|logos?|registrations?"
)
METRIC = re.compile(
    rf"(?:[$€£]\s?\d[\d,.]*\s?[kmb]?\b|\b\d[\d,.]*\s?(?:%|[kmb]\b|(?:{_UNITS})\b)|"
    rf"\b(?:{_NUMBER_WORDS})(?:[\s-]+(?:{_NUMBER_WORDS}|point|and))*\s+(?:{_UNITS})\b)",
    re.IGNORECASE,
)


def content_words(text: str) -> list[str]:
    """Lower-cased words that carry meaning (no stopwords, numbers or very short words)."""
    words = (w.lower().replace("’", "'").strip("'-") for w in WORD.findall(text))
    return [w for w in words if len(w) > 2 and w not in STOPWORDS and not w.isdigit()]
