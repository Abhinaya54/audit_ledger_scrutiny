# backend/tests/test_nl_query.py

import pytest
from services.nl_query.service import parse_nl_query
from services.nl_query.parsers import parse_amount, parse_range, parse_voucher_types, parse_dates

class TestControlMatching:
    def test_direct_control_mention(self):
        res = parse_nl_query("Show me weekend entries")
        assert "Weekend Entries" in res["matched_controls"]
        
    def test_keyword_mapping(self):
        res = parse_nl_query("find duplicate postings and manual entries")
        assert "Duplicate Check" in res["matched_controls"]
        assert "Manual Journal" in res["matched_controls"]

class TestAmountParsing:
    def test_plain_numbers(self):
        assert parse_amount("10000") == 10000
        assert parse_amount("10,000") == 10000
        
    def test_k_thousand(self):
        assert parse_amount("10k") == 10000
        assert parse_amount("5 thousand") == 5000
        
    def test_lakh_lac(self):
        assert parse_amount("1 lakh") == 100000
        assert parse_amount("5 lacs") == 500000
        
    def test_crore_cr(self):
        assert parse_amount("1 crore") == 10000000
        assert parse_amount("2 cr") == 20000000
        
    def test_million_mn(self):
        assert parse_amount("1 million") == 1000000
        assert parse_amount("0.5 mn") == 500000

class TestRangeParsing:
    def test_between_range(self):
        res = parse_range("between 10k and 50k")
        assert res["min"] == 10000
        assert res["max"] == 50000
        
    def test_above_range(self):
        res = parse_range("above 1 lakh")
        assert res["min"] == 100000
        assert res["max"] is None
        
    def test_below_range(self):
        res = parse_range("below 5000")
        assert res["min"] is None
        assert res["max"] == 5000
        
    def test_at_least_at_most(self):
        assert parse_range("at least 1000")["min"] == 1000
        assert parse_range("at most 5000")["max"] == 5000

class TestVoucherTypeParsing:
    def test_voucher_types(self):
        assert "payment" in parse_voucher_types("show payment and receipt vouchers")
        assert "receipt" in parse_voucher_types("show payment and receipt vouchers")
        assert "journal" in parse_voucher_types("manual journal entries")

class TestDateParsing:
    def test_month_names(self):
        res = parse_dates("entries in January and Feb")
        assert res["months"] == [1, 2]
        
    def test_quarter_references(self):
        res = parse_dates("Q1 and quarter 3")
        assert res["quarters"] == [1, 3]

class TestAutoModeRouting:
    def test_prefers_deterministic(self):
        res = parse_nl_query("weekend entries", parser_type="auto")
        assert res["parser_used"] == "deterministic"
        assert "Weekend Entries" in res["matched_controls"]
        
    def test_tax_is_deterministic(self):
        # Tax/TDS is now in the registry, so deterministic parser handles it
        res = parse_nl_query("tax compliance check", parser_type="auto")
        assert res["parser_used"] == "deterministic"
        assert "Tax & TDS Compliance" in res["matched_controls"]

class TestMockLLMMode:
    def test_llm_mode_explicit(self):
        res = parse_nl_query("some complex query", parser_type="llm")
        assert res["parser_used"] == "llm"

class TestThresholdWarnings:
    def test_warning_triggered(self):
        # "High Value Transactions" has default 100,000
        res = parse_nl_query("high value transactions above 50,000")
        assert any("lower than" in w for w in res["warnings"])
        
    def test_warning_with_override(self):
        # Override High Value to 200,000. User asks for 150,000. Warning should trigger.
        res = parse_nl_query(
            "high value transactions above 150,000", 
            entity_thresholds={"High Value Transactions": 200000}
        )
        assert any("lower than" in w for w in res["warnings"])
        assert "200,000" in res["warnings"][0]

class TestNoMatchFallback:
    def test_gibberish_query(self):
        res = parse_nl_query("random gibberish that matches nothing")
        # In auto mode, if deterministic fails, it goes to LLM
        assert res["parser_used"] == "llm"
        assert res["matched_controls"] == []

class TestIntentGeneration:
    def test_complex_intent(self):
        res = parse_nl_query("Filter Sunday entries and amount between 10k and 50k in Q1 for payment vouchers")
        intent = res["intent"]
        assert "Weekend Entries" in intent
        assert "between 10,000 and 50,000" in intent
        assert "Q1" in intent
        assert "payment" in intent

    def test_intent_with_tax(self):
        res = parse_nl_query("tax entries above 10k")
        assert "Tax & TDS Compliance" in res["intent"]
        assert "amount > 10,000" in res["intent"]

class TestRegistryCohesion:
    """Ensures the NL registry stays in sync with the rules_engine."""
    
    def test_all_engine_rules_are_in_registry(self):
        from scrutiny.engine import RULES
        from services.nl_query.registry import CONTROL_REGISTRY
        registry_labels = {c["label"] for c in CONTROL_REGISTRY}
        for label in RULES:
            assert label in registry_labels, f"Engine rule '{label}' missing from NL registry"
    
    def test_engine_rules_have_keywords(self):
        from services.nl_query.registry import CONTROL_REGISTRY
        for ctrl in CONTROL_REGISTRY:
            if ctrl["has_rule_fn"]:
                assert len(ctrl["keywords"]) > 0, f"Control '{ctrl['label']}' has no NL keywords"
    
    def test_ids_match_labels(self):
        from services.nl_query.registry import CONTROL_REGISTRY
        for ctrl in CONTROL_REGISTRY:
            assert ctrl["id"] == ctrl["label"], (
                f"Control ID '{ctrl['id']}' does not match label '{ctrl['label']}'"
            )

class TestArchitectEdgeCases:
    def test_amount_ambiguity_months(self):
        assert parse_amount("3 months") is None
        assert parse_amount("3 m") is None
        
    def test_range_greedy_regex(self):
        res = parse_range("between 10k and entries above 50k")
        assert res["min"] == 10000
        assert res["max"] == 50000
        
    def test_warning_skip_non_registry(self):
        from services.nl_query.warnings import generate_warnings
        warnings = generate_warnings(["BOGUS_ID"], {"amount_min": 1000})
        assert warnings == []
