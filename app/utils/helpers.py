import re
import random
import string
import os

def generate_room_code() -> str:
    """
    Generates a secure 8-character room code in the format ABCD-1234.
    The first block contains 4 uppercase letters, and the second contains 4 digits.
    """
    letters = ''.join(random.choices(string.ascii_uppercase, k=4))
    digits = ''.join(random.choices(string.digits, k=4))
    return f"{letters}-{digits}"

def validate_room_code(code: str) -> bool:
    """
    Validates that a room code matches the pattern XXXX-XXXX (where X can be letter or number).
    """
    pattern = r"^[A-Z0-9]{4}-[A-Z0-9]{4}$"
    return bool(re.match(pattern, code.upper()))

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filenames to prevent directory traversal and remove unsafe characters.
    Replaces spaces with underscores and keeps only safe characters.
    """
    # Get just the basename to prevent path traversal
    base = os.path.basename(filename)
    # Strip leading/trailing whitespaces
    base = base.strip()
    # Replace spaces with underscores
    base = base.replace(' ', '_')
    # Filter for alphanumeric, dots, hyphens, and underscores
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '', base)
    # Fallback if sanitized becomes empty
    if not sanitized or sanitized in ('.', '..'):
        sanitized = "transferred_file"
    return sanitized
