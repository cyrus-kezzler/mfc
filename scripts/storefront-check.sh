#!/usr/bin/env bash
#
# storefront-check.sh
#
# Checks the Myatt's Fields storefront the way a CUSTOMER experiences it, not
# the way a server reports it.
#
# WHY THIS EXISTS (13 Jul 2026): the Choose Six box builder and Dick the AI
# bartender were both dead on the live shop for an unknown length of time. The
# drinks API returned 200 OK the whole time. It hardcoded
# Access-Control-Allow-Origin: https://mfc.london, the shop had moved to
# myattsfields.london, and so the browser silently refused every response and
# the customer got an apology box. A CORS failure is INVISIBLE from the server:
# it does its job, returns 200, and there is no log line anywhere.
#
# That is the same shape as every other failure that week: lastRun green while
# nothing ran, a Klaviyo template that looked finished and could never send,
# DNS resolving perfectly while every email failed authentication. In each case
# the system reported healthy and the customer saw broken.
#
# So this script asserts CONTRACTS, from outside, as a stranger. No connectors,
# no browser, no auth. It cannot raise a permission dialog and it cannot lose a
# browser session, which is why it will still be running in a year.
#
# Exit 0 = all good (silence). Exit 1 = something a customer would notice.

set -uo pipefail

SHOP="https://myattsfields.london"
LEGACY="https://mfc.london"          # still redirects; PRINTED ON THE BOTTLE LABELS
API="https://mfc-batch-calculator.vercel.app"
FLIGHT="https://flight.myattsfields.london"

FAILURES=()
fail() { FAILURES+=("$1"); printf '  FAIL  %s\n' "$1"; }
pass() { printf '  ok    %s\n' "$1"; }

echo "Myatt's Fields storefront check, $(date -u '+%Y-%m-%d %H:%M UTC')"
echo

# ---------------------------------------------------------------- 1. CORS
# The exact bug of 13 Jul. If the API will not talk to the shop's origin, the
# picker dies and the customer sees an apology box, while the API says 200.
echo "CORS contract (the 13 Jul bug)"
for path in /api/choose-six/drinks /api/dick; do
  acao=$(curl -s -m 15 -D - -o /dev/null -X OPTIONS \
          -H "Origin: $SHOP" -H "Access-Control-Request-Method: GET" \
          "$API$path" | grep -i '^access-control-allow-origin' | cut -d: -f2- | tr -d '\r' | xargs)
  if [ "$acao" = "$SHOP" ]; then pass "$path allows the live shop origin"
  else fail "$path does NOT allow $SHOP (returns '${acao:-nothing}'). The customer sees a broken widget."; fi
done

# The legacy domain is on the bottle labels. It must keep working.
acao=$(curl -s -m 15 -D - -o /dev/null -H "Origin: $LEGACY" "$API/api/choose-six/drinks" \
        | grep -i '^access-control-allow-origin' | cut -d: -f2- | tr -d '\r' | xargs)
[ "$acao" = "$LEGACY" ] && pass "legacy $LEGACY still allowed (it is printed on the labels)" \
                        || fail "legacy $LEGACY rejected. The bottle labels point at a dead door."

# Vary: Origin, or the CDN caches one origin's header and serves it to another.
curl -s -m 15 -D - -o /dev/null -H "Origin: $SHOP" "$API/api/choose-six/drinks" \
  | grep -qi '^vary:.*origin' && pass "Vary: Origin set (CDN cannot poison the header)" \
                              || fail "Vary: Origin MISSING. The CDN can serve one domain's CORS header to another."

# ---------------------------------------------------------------- 2. THE DATA
echo
echo "The drinks the picker needs"
body=$(curl -s -m 20 "$API/api/choose-six/drinks")
n_drinks=$(printf '%s' "$body" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('drinks',[])))" 2>/dev/null || echo 0)
n_presets=$(printf '%s' "$body" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('presets',[])))" 2>/dev/null || echo 0)
[ "$n_drinks" -ge 6 ]  && pass "$n_drinks drinks returned"   || fail "only $n_drinks drinks returned. You cannot fill six slots."
[ "$n_presets" -ge 1 ] && pass "$n_presets presets returned" || fail "no presets. The one-click boxes are gone."

# ---------------------------------------------------------------- 3. THE PAGES
echo
echo "The pages a customer lands on"
for u in "$SHOP/products/boxset" "$SHOP/products/martini-flight" "$FLIGHT/"; do
  code=$(curl -s -m 20 -o /tmp/p.$$ -w '%{http_code}' -L "$u")
  [ "$code" = "200" ] && pass "$u -> 200" || fail "$u -> HTTP $code"
  rm -f /tmp/p.$$
done

# The builder's mount point must be in the HTML, or the widget never boots.
# NOTE: write to a file first. `curl | grep -q` closes the pipe early, curl dies
# of SIGPIPE, and `set -o pipefail` then reports a failure that is not real.
# (Learned by writing that exact bug into the first version of this script.)
page=$(mktemp)
curl -s -m 20 -L "$SHOP/products/boxset" -o "$page"
if grep -q 'mfc-c6-root' "$page"; then pass "the Choose Six builder is mounted on the page"
else fail "mfc-c6-root is GONE from the boxset page. The theme has dropped the builder."; fi

# The widget JS is served from Vercel. If that 404s, the mount point sits empty.
if grep -q 'choose-six-widget.js' "$page"; then pass "the widget script tag is present"
else fail "the choose-six-widget.js script tag is missing from the page."; fi
rm -f "$page"

code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$API/choose-six-widget.js")
[ "$code" = "200" ] && pass "choose-six-widget.js loads (HTTP 200)" \
                    || fail "choose-six-widget.js -> HTTP $code. The builder cannot boot."

# ---------------------------------------------------------------- 4. EMAIL AUTH
# Fixed 12 Jul. Guard against a regression: one SPF record, relaxed DMARC
# alignment, and Klaviyo's DKIM present. Get this wrong and every email fails.
echo
echo "Email authentication (fixed 12 Jul, guard the regression)"
spf=$(dig +short TXT myattsfields.london | grep -c 'v=spf1')
[ "$spf" -eq 1 ] && pass "exactly one SPF record" \
                 || fail "$spf SPF records. More than one is a PermError: SPF fails for ALL mail."
dmarc=$(dig +short TXT _dmarc.myattsfields.london)
printf '%s' "$dmarc" | grep -q 'adkim=s' \
  && fail "DMARC is back to STRICT alignment. Klaviyo signs on a subdomain, so DMARC will fail on every send." \
  || pass "DMARC alignment relaxed (Klaviyo's news. subdomain aligns)"
dig +short CNAME s1._domainkey.news.myattsfields.london | grep -q sendgrid \
  && pass "Klaviyo DKIM published" || fail "Klaviyo DKIM missing on news.myattsfields.london"

# ---------------------------------------------------------------- verdict
echo
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "ALL CLEAR. A customer can find it, see it, build it and buy it."
  exit 0
fi
echo "${#FAILURES[@]} FAILURE(S) A CUSTOMER WOULD NOTICE:"
printf '  - %s\n' "${FAILURES[@]}"
exit 1
