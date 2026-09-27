"""Детермінований хеш — побітово той самий, що в `crystalV2/hash.ts`.

FNV-1a 32 по UTF-8 плюс фінальне перемішування murmur3 (fmix32). Жодного
`random`: той самий рядок дає те саме число в Python і в браузері.
"""

MASK = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & MASK


def hash32(text: str) -> int:
    h = 0x811C9DC5
    for byte in text.encode("utf-8"):
        h ^= byte
        h = _imul(h, 0x01000193)
    h ^= h >> 16
    h = _imul(h, 0x85EBCA6B)
    h ^= h >> 13
    h = _imul(h, 0xC2B2AE35)
    h ^= h >> 16
    return h & MASK


def unit(seed: str, tag: str) -> float:
    """Число в [0, 1) з пари (зерно, мітка)."""
    return hash32(f"{seed}|{tag}") / 4294967296.0
