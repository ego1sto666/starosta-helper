"""Создать закрытый ключ VAPID и вывести открытый ключ для .env."""
import argparse
import base64
import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("private_file", type=Path)
    path = parser.parse_args().private_file
    path.parent.mkdir(parents=True, exist_ok=True)
    key = ec.generate_private_key(ec.SECP256R1())
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        parser.error("Ключ уже существует. Выберите новый путь или используйте старую пару ключей.")
    with os.fdopen(fd, "wb") as private:
        private.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                        serialization.NoEncryption()))
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    print("STAROSTA_PUSH_PUBLIC_KEY=" + base64.urlsafe_b64encode(public).decode().rstrip("="))


if __name__ == "__main__":
    main()
