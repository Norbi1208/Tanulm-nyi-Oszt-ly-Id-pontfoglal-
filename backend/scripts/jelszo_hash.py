import sys
import bcrypt

jelszo = sys.argv[1] if len(sys.argv) > 1 else input("Jelszó: ")
print(bcrypt.hashpw(jelszo.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"))