import sys
import os
import time
from collections import defaultdict


def maxi(x, y):
    """Return (new_x, changed) where new_x = max(x, y)."""
    if x < y:
        return y, True
    return x, False


def mini(x, y):
    """Return (new_x, changed) where new_x = min(x, y)."""
    if x > y:
        return y, True
    return x, False


def inp():
    n = int(sys.stdin.readline())
    mp = {}
    for _ in range(n):
        tokens = sys.stdin.readline().split()
        s = tokens[0]
        p = int(tokens[1])
        # Mirrors: if(mp[str] == 0) mp[str] = p; else mp[str] = min(mp[str], p);
        if mp.get(s, 0) == 0:
            mp[s] = p
        else:
            mp[s] = min(mp[s], p)
    ans = 0
    for key in sorted(mp):
        ans += mp[key]      
    sys.stdout.write(f"{len(mp)} {ans}")


class sub1:
    @staticmethod
    def slv():
        pass


def main():
    qs = False
    base = "qs"
    if os.path.exists(base + ".inp"):
        sys.stdin = open(base + ".inp", "r")
        sys.stdout = open(base + ".out", "w")

    T = 1
    if qs:
        T = int(sys.stdin.readline())
    while T > 0:
        inp()
        sub1.slv()
        T -= 1

    sys.stderr.write(f"\nTime {0.001 * time.process_time() * 1000:.0f}s ")


if __name__ == "__main__":
    main()
