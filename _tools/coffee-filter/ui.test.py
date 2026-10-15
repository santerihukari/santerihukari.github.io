"""Read-only checks for the coffee configurator's static control contract."""
from pathlib import Path
import unittest

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]


class CoffeeControlTests(unittest.TestCase):
    def test_control_ids_are_unique(self):
        soup = BeautifulSoup((ROOT / '_includes/coffee-filter-configurator.html').read_text(encoding='utf8'), 'html.parser')
        ids = [node['id'] for node in soup.select('[id]')]
        self.assertEqual(len(ids), len(set(ids)), 'Coffee controls must not contain duplicate IDs')
        self.assertEqual(len(soup.select('#frontAccessReadout')), 1)


if __name__ == '__main__':
    unittest.main()
