#!/usr/bin/env python3
"""
CSV → JSON 변환 스크립트.
server/lib/master/*.csv → client/public/master/*.json

사용법:
  python3 csv_to_json.py                  # 모든 CSV 변환
  python3 csv_to_json.py item             # item.csv만 변환
  python3 csv_to_json.py item pokemon     # 여러 파일 지정
"""

import ast
import csv
import json
import sys
from pathlib import Path
from typing import Callable

MASTER_DIR = Path(__file__).parent
CLIENT_MASTER_DIR = MASTER_DIR.parents[2] / "client" / "public" / "master"

# ── 변환 함수 ───────────────────────────────────────────────────
def _bool(v: str) -> bool:
    return v.strip().upper() == "TRUE"

def _int(v: str) -> int:
    return int(v.strip())

def _float(v: str) -> float:
    return float(v.strip())

def _str(v: str) -> str:
    return v.strip()

_SMART_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'})

def _list(v: str) -> list:
    """Python 리터럴 리스트 문자열을 파싱한다 (예: "['a', 'b']" → ['a', 'b'])."""
    # CSV 에 스마트 따옴표(’, ‘) 가 섞여 있는 셀이 있어 일반 따옴표로 정규화한 뒤 파싱한다.
    s = v.strip().translate(_SMART_QUOTES)
    if not s:
        return []
    return ast.literal_eval(s)


# ── CSV id → JSON dict key 변환 ────────────────────────────────
def _pad4_or_str(v: str) -> str:
    # 숫자 id 는 4 자리로 zero-pad ("1" → "0001"), 알파넘 id 는 그대로 ("0003-mega").
    s = v.strip()
    return s.zfill(4) if s.isdigit() else s

ID_KEY_TRANSFORMS: dict[str, Callable[[str], str]] = {
    "pokemon": _pad4_or_str,
}


# ── CSV 컬럼 → 클라이언트 JSON 필드 매핑 ──────────────────────────
# (csv_col, json_key, converter)
# json_key 가 None 이면 클라이언트 JSON 에서 제외 (서버 전용).
# json_key 에 점(".") 이 포함되면 중첩 객체로 저장 (예: "rate.capture" → {rate: {capture: ...}}).

# item.csv 매핑
ITEM_MAPPING: list[tuple[str, str | None, any]] = [
    ("id",          "id",          _str),
    ("comment",     "comment",     _str),
    ("category",    "category",    _str),
    ("buy",         "buyPrice",    _int),
    ("sell",        "sellPrice",   _int),
    ("purchasable", "purchasable", _bool),
    ("sellable",    "sellable",    _bool),
    ("tier",        "tier",        _str),
    # 서버 전용 필드 — 클라이언트 JSON 에서 제외
    ("spawn_max",   None,          None),
    ("spawn_rate",  None,          None),
    ("spawnable",   None,          None),
]

# pokemon.csv 매핑
POKEMON_MAPPING: list[tuple[str, str | None, any]] = [
    # id 는 dict key 로만 사용 (entry 에는 포함하지 않음)
    ("id",           None,            None),
    ("comment",      "comment",       _str),
    ("ability",      "ability",       _list),
    ("evol_next",    "nextEvol.next", _list),
    ("evol_cost",    "nextEvol.cost", _list),
    ("form_next",    "form",          _list),
    ("form_cost",    None,            None),
    ("generation",   "generation",    _str),
    ("height_m",     "height_m",      _str),
    ("weight_kg",    "weight_kg",     _str),
    ("rate_spawn",   "rate.spawn",    _int),
    ("rate_capture", "rate.capture",  _float),
    ("rate_flee",    "rate.flee",     _float),
    ("rate_male",    "rate.male",     _float),
    ("rate_female",  "rate.female",   _float),
    ("skills",       "skills",        _list),
    ("spawn",        "spawn",         _list),
    ("tier",         "rank",          _str),
    ("type1",        "type1",         _str),
    ("type2",        "type2",         _str),
    ("growth_group", "growthGroup",   _str),
    ("base_exp",     "baseExp",       _int),
]

MAPPINGS: dict[str, list[tuple[str, str | None, any]]] = {
    "item": ITEM_MAPPING,
    "pokemon": POKEMON_MAPPING,
}


def _set_nested(d: dict, path: str, value) -> None:
    """점(".") 으로 구분된 경로를 따라 중첩 객체에 값을 저장한다."""
    keys = path.split(".")
    cur = d
    for k in keys[:-1]:
        cur = cur.setdefault(k, {})
    cur[keys[-1]] = value


def convert(name: str) -> None:
    csv_path = MASTER_DIR / f"{name}.csv"
    json_path = CLIENT_MASTER_DIR / f"{name}.json"

    if not csv_path.exists():
        print(f"[SKIP] {csv_path} not found")
        return

    mapping = MAPPINGS.get(name)
    if not mapping:
        print(f"[SKIP] No mapping defined for '{name}'")
        return

    # csv_col → (json_key, converter)
    col_map: dict[str, tuple[str, any]] = {}
    for csv_col, json_key, converter in mapping:
        if json_key is not None:
            col_map[csv_col] = (json_key, converter)

    id_transform = ID_KEY_TRANSFORMS.get(name, _str)
    result: dict[str, dict] = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry: dict = {}
            for csv_col, value in row.items():
                if csv_col in col_map:
                    json_key, converter = col_map[csv_col]
                    _set_nested(entry, json_key, converter(value))

            item_id = id_transform(row.get("id", ""))
            if item_id:
                result[item_id] = entry

    CLIENT_MASTER_DIR.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[OK] {csv_path.name} → {json_path}  ({len(result)} entries)")


def main() -> None:
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(MAPPINGS.keys())
    for name in targets:
        convert(name)


if __name__ == "__main__":
    main()
