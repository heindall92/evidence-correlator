import unittest
from datetime import timedelta, timezone

from trama.timeutil import parse_utc, parse_window


class ParseUtcTest(unittest.TestCase):
    def test_z_suffix_and_millis(self):
        dt = parse_utc("2026-10-21T08:15:10.120Z")
        self.assertEqual((dt.hour, dt.minute, dt.second, dt.microsecond), (8, 15, 10, 120000))
        self.assertEqual(dt.tzinfo, timezone.utc)

    def test_offset_is_converted_to_utc(self):
        self.assertEqual(parse_utc("2026-10-21T10:15:10+02:00"), parse_utc("2026-10-21T08:15:10Z"))

    def test_nanoseconds_and_no_zone(self):
        dt = parse_utc("2026-10-21T08:15:10.123456789")
        self.assertEqual(dt.microsecond, 123456)

    def test_invalid(self):
        for bad in ("", "ayer", None, "2026-10-21", 123):
            with self.assertRaises(ValueError):
                parse_utc(bad)


class ParseWindowTest(unittest.TestCase):
    def test_units(self):
        self.assertEqual(parse_window("45m"), timedelta(minutes=45))
        self.assertEqual(parse_window("120s"), timedelta(seconds=120))
        self.assertEqual(parse_window("2H"), timedelta(hours=2))
        self.assertEqual(parse_window("1d"), timedelta(days=1))

    def test_invalid_is_rejected_not_defaulted(self):
        for bad in ("45", "m", "10x", "-5m", "0m", None):
            with self.assertRaises(ValueError):
                parse_window(bad)


if __name__ == "__main__":
    unittest.main()
