#!/usr/bin/env bash
# Compare every record in the GoDaddy snapshot (godaddy-zone.txt) against what a nameserver
# actually serves. Usage:
#   scripts/dns/parity.sh                      # against Vercel (ns1.vercel-dns.com)
#   scripts/dns/parity.sh ns15.domaincontrol.com
#   scripts/dns/parity.sh 1.1.1.1              # public resolver, after the switch
# Exit code 0 only when every name/type returns exactly the same set of values.
set -u
cd "$(dirname "$0")"
NS="${1:-ns1.vercel-dns.com}"
FLAGS="+short"; [[ "$NS" =~ ^[0-9.]+$ ]] || FLAGS="+short +norecurse"
fail=0; checked=0
norm() { sed -e 's/\.$//' -e 's/" "//g' -e 's/"//g' | tr 'A-Z' 'a-z' | sort; }
while read -r t n; do
  fq=$([ "$n" = "@" ] && echo ittogether.com.au || echo "$n.ittogether.com.au")
  want=$(awk -v f="$fq." -v t="$t" '$1==f && $4==t { $1=$2=$3=$4=""; sub(/^ +/,""); print }' godaddy-zone.txt | norm)
  got=$(dig $FLAGS @"$NS" "$fq" "$t" | norm)
  checked=$((checked+1))
  if [ "$want" != "$got" ]; then
    fail=$((fail+1)); echo "✗ $t $n"; echo "   want: $(echo "$want" | tr '\n' ' ')"; echo "   got:  $(echo "$got" | tr '\n' ' ')"
  fi
done < names.txt
echo "$checked names checked against $NS — $fail mismatched"
[ "$fail" -eq 0 ]
