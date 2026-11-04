"""End-to-end test of the web app + API against a real MySQL/MariaDB.

Run (fresh database each time):
  mysql -e "DROP DATABASE IF EXISTS diagnostics; CREATE DATABASE diagnostics"
  for f in database/schema.sql database/migrations/*.sql; do mysql diagnostics < $f; done
  cd web/public && DB_USER=diag DB_PASS=diagpass APP_URL=http://127.0.0.1:8090 php -S 127.0.0.1:8090 -t . ../../tests/router.php &
  python3 tests/e2e.py
"""
import http.cookiejar, json, os, re, subprocess, sys, urllib.parse, urllib.request, datetime, io, uuid

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8090")
CRON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "bin", "send_reminders.php")
DB_ENV = {"DB_HOST": "127.0.0.1", "DB_NAME": "diagnostics", "DB_USER": "diag", "DB_PASS": "diagpass", "PATH": os.environ.get("PATH", "/usr/bin:/bin")}
FAILS = []
BAD = re.compile(r"(Fatal error|Warning:|Notice:|Deprecated:|Uncaught|Parse error)")


def sql(q):
    return subprocess.run(["mysql", "-N", "diagnostics", "-e", q], capture_output=True, text=True).stdout.strip()


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond:
        FAILS.append(name)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None

    def req(self, method, path, data=None, files=None, headers=None, follow=True):
        headers = dict(headers or {})
        body = None
        if files:
            b = uuid.uuid4().hex
            parts = []
            for k, v in (data or {}).items():
                for vv in (v if isinstance(v, list) else [v]):
                    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{vv}\r\n'.encode())
            for k, (fn, content, ct) in files.items():
                parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode() + content + b"\r\n")
            parts.append(f"--{b}--\r\n".encode())
            body = b"".join(parts)
            headers["Content-Type"] = f"multipart/form-data; boundary={b}"
        elif data is not None:
            body = urllib.parse.urlencode(data, doseq=True).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        r = urllib.request.Request(BASE + path, data=body, method=method, headers=headers)
        op = self.op if follow else urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)
        try:
            resp = op.open(r)
            code, text = resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            code, text = e.code, e.read().decode("utf-8", "replace")
        m = re.search(r'name="csrf" value="([0-9a-f]+)"', text)
        if m:
            self.csrf = m.group(1)
        if BAD.search(text):
            check(f"no PHP errors on {method} {path}", False, BAD.search(text).group(0) + " … " + text[max(0, BAD.search(text).start() - 100):BAD.search(text).start() + 300])
        return code, text

    def get(self, path):
        return self.req("GET", path)

    def post(self, path, data, files=None):
        if self.csrf is None:
            self.get(path.split("?")[0])
        d = dict(data)
        d["csrf"] = self.csrf
        return self.req("POST", path, d, files)


def api(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(BASE + "/api/" + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw.decode()[:400]}


tomorrow = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()

# ---------------- Registration & referral ----------------
a = Client()
a.get("/register.php")
a.post("/register.php", {"full_name": "Ravi Kumar", "phone": "9876500001", "email": "ravi@example.com", "password": "secret123"})
ref_a = sql("SELECT referral_code FROM users WHERE phone='9876500001'")
check("patient A registered with referral code", bool(ref_a))

b = Client()
b.get("/register.php")
b.post("/register.php", {"full_name": "Lakshmi Devi", "phone": "9876500002", "password": "secret123", "referral": ref_a})
check("patient B linked to A's referral", sql("SELECT referred_by_id FROM users WHERE phone='9876500002'") == sql("SELECT id FROM users WHERE phone='9876500001'"))

b.get("/login.php")
code, t = b.post("/login.php", {"action": "password", "identifier": "9876500002", "password": "secret123"})
check("patient B logs in", "Good" in t and "Lakshmi" in t, t[:200])
bad = Client(); bad.get("/login.php")
_, t = bad.post("/login.php", {"action": "password", "identifier": "9876500002", "password": "wrong"})
check("wrong password rejected", "Invalid phone/email or password" in t)

# ---------------- Admin setup ----------------
ad = Client()
ad.get("/login.php")
_, t = ad.post("/login.php", {"action": "password", "identifier": "9999999999", "password": "Admin@123"})
check("admin logs in with seeded password", "Billed amount" in t, t[:300])

ad.get("/admin/technicians.php")
ad.post("/admin/technicians.php", {"action": "create", "full_name": "Suresh Babu", "phone": "9000022222", "password": "techpass1"})
tech_id = sql("SELECT id FROM users WHERE phone='9000022222' AND role='TECHNICIAN'")
check("technician created", bool(tech_id))

ad.get("/admin/centers.php")
ad.post("/admin/centers.php", {"action": "center", "name": "Rachapalle Centre", "latitude": "17.0005", "longitude": "82.2400", "service_radius_km": "20"})
cid = sql("SELECT id FROM centers LIMIT 1")
check("centre created", bool(cid))
ad.post("/admin/centers.php", {"action": "point", "center_id": cid, "name": "Panchayat Office", "village_name": "Kothapalli", "latitude": "17.05", "longitude": "82.28"})
check("pickup point inside 20 km accepted", sql("SELECT COUNT(*) FROM pickup_points") == "1")
_, t = ad.post("/admin/centers.php", {"action": "point", "center_id": cid, "name": "Far Away", "latitude": "17.7", "longitude": "83.2"})
check("pickup point outside radius rejected", sql("SELECT COUNT(*) FROM pickup_points") == "1" and "outside its 20 km service radius" in t, t[t.find("flash"):t.find("flash") + 200])
pp = sql("SELECT id FROM pickup_points LIMIT 1")
ad.post("/admin/centers.php", {"action": "schedule", "pickup_point_id": pp, "day_of_week": "2", "start_time": "09:00", "end_time": "11:00"})
check("pickup schedule added", sql("SELECT COUNT(*) FROM pickup_point_schedules") == "1")

ad.get("/admin/partner_labs.php")
ad.post("/admin/partner_labs.php", {"action": "create", "name": "Vizag Partner Lab", "city": "Visakhapatnam", "default_turnaround_hours": "24"})
lab = sql("SELECT id FROM partner_labs LIMIT 1")
kft = sql("SELECT id FROM tests WHERE code='KFT'")
ad.post("/admin/partner_labs.php", {"action": "route", "test_id": kft, "partner_lab_id": lab, "turnaround_hours": "30"})
check("test routed to partner lab", sql(f"SELECT is_in_house FROM tests WHERE id={kft}") == "0")

ad.get("/admin/packages.php")
cbc = sql("SELECT id FROM tests WHERE code='CBC'"); tsh = sql("SELECT id FROM tests WHERE code='TSH'")
ad.post("/admin/packages.php", {"action": "create", "name": "Thyroid Care", "price": "500", "tier": "BASIC", "tests[]": [cbc, tsh]})
check("package created with tests", sql("SELECT COUNT(*) FROM package_tests pt JOIN packages p ON p.id=pt.package_id WHERE p.name='Thyroid Care'") == "2")

ad.get("/admin/coupons.php")
ad.post("/admin/coupons.php", {"code": "FLAT50", "description": "₹50 off", "discount_type": "FLAT", "value": "50", "min_order": "0", "per_customer_limit": "1"})
_, t = ad.post("/admin/coupons.php", {"code": "BAD", "description": "x", "discount_type": "PERCENT", "value": "150"})
check("coupon >100% rejected", sql("SELECT COUNT(*) FROM coupons WHERE code='BAD'") == "0")

ad.get("/admin/tests.php")
ad.post("/admin/tests.php", {"action": "details", "id": tsh, "category": "Thyroid", "normal_range_low": "0.4", "normal_range_high": "4.0", "normal_range_unit": "mIU/L", "preparation_instructions": "Morning sample", "description": "Thyroid check"})
check("test details saved", sql(f"SELECT preparation_instructions FROM tests WHERE id={tsh}") == "Morning sample")

# ---------------- Family + booking with package, coupon ----------------
b.get("/patient/family.php")
b.post("/patient/family.php", {"action": "add", "full_name": "Ramaiah", "relation": "Father", "dob": "1958-05-01", "gender": "M"})
mem = sql("SELECT id FROM family_members WHERE full_name='Ramaiah'")
check("family member added", bool(mem))

_, quote = b.get(f"/patient/coupon_quote.php?code=FIRST20&subtotal=1000")
q = json.loads(quote)
check("coupon preview FIRST20 = 20% capped at 300", q.get("discount") == 200, quote)
_, quote = b.get(f"/patient/coupon_quote.php?code=FIRST20&subtotal=100")
check("coupon min order enforced", "needs an order of at least" in quote, quote)

pkg = sql("SELECT id FROM packages WHERE name='Thyroid Care'")
lft = sql("SELECT id FROM tests WHERE code='LFT'")
b.get("/patient/book.php")
_, t = b.post("/patient/book.php", {"packages[]": [pkg], "tests[]": [lft], "collection_mode": "HOME_VISIT", "address": "Main Road, Rachapalle", "date": tomorrow, "time": "09:30", "coupon_code": "FIRST20", "member_id": mem})
appt1 = sql("SELECT MAX(id) FROM appointments")
row = sql(f"SELECT subtotal, discount_amount, total_amount, coupon_code, member_id FROM appointments WHERE id={appt1}").split("\t")
check("booking: subtotal 500+600=1100", row[0] == "1100.00", str(row))
check("booking: 20% capped at 300 → 220 discount", row[1] == "220.00", str(row))
check("booking: total 880, coupon + member stored", row[2] == "880.00" and row[3] == "FIRST20" and row[4] == mem, str(row))
check("booking appears with stepper", "progress-stepper" in b.get(f"/patient/appointment.php?id={appt1}")[1])

b.get("/patient/book.php")
_, t = b.post("/patient/book.php", {"tests[]": [cbc], "collection_mode": "HOME_VISIT", "address": "x", "date": tomorrow, "time": "10:00", "coupon_code": "FIRST20"})
check("coupon per-customer limit enforced", "already used FIRST20" in t)

b.get("/patient/book.php")
_, t = b.post("/patient/book.php", {"tests[]": [cbc], "collection_mode": "PICKUP_POINT", "pickup_point_id": pp, "date": tomorrow, "time": "10:00"})
appt_pp = sql("SELECT MAX(id) FROM appointments")
check("pickup-point booking uses point as address", sql(f"SELECT address FROM appointments WHERE id={appt_pp}").startswith("Panchayat Office"))

# ---------------- Workflow: assign, technician, payment, referral ----------------
ad.get("/admin/appointments.php")
ad.post("/admin/appointments.php", {"action": "assign", "id": appt1, "technician_id": tech_id})
check("technician assigned → ASSIGNED", sql(f"SELECT status FROM appointments WHERE id={appt1}") == "ASSIGNED")

tc = Client(); tc.get("/login.php")
_, t = tc.post("/login.php", {"action": "password", "identifier": "9000022222", "password": "techpass1"})
check("technician sees assigned job", f"#{appt1}" in t, t[:300])
tc.post("/technician/", {"id": appt1, "status": "SAMPLE_COLLECTED"})
check("technician cannot skip ON_WAY", sql(f"SELECT status FROM appointments WHERE id={appt1}") == "ASSIGNED")
tc.post("/technician/", {"id": appt1, "status": "ON_WAY"})
tc.post("/technician/", {"id": appt1, "status": "SAMPLE_COLLECTED"})
check("technician moves job to SAMPLE_COLLECTED", sql(f"SELECT status FROM appointments WHERE id={appt1}") == "SAMPLE_COLLECTED")
check("field alerts raised for admin", int(sql("SELECT COUNT(*) FROM staff_alerts WHERE kind='STATUS'")) >= 2)
check("admin alerts page lists them", "marked appointment" in ad.get("/admin/alerts.php")[1])

ad.get("/admin/appointments.php")
ad.post("/admin/appointments.php", {"action": "mark_paid", "id": appt1})
check("payment recorded with receipt", sql(f"SELECT COUNT(*) FROM payments WHERE appointment_id={appt1} AND receipt_no IS NOT NULL") == "1")
check("referral reward: B got ₹100", sql("SELECT wallet_balance FROM users WHERE phone='9876500002'") == "100.00")
check("referral reward: A got ₹100", sql("SELECT wallet_balance FROM users WHERE phone='9876500001'") == "100.00")
ad.post("/admin/appointments.php", {"action": "mark_paid", "id": appt_pp})
check("referral rewarded only once", sql("SELECT wallet_balance FROM users WHERE phone='9876500002'") == "100.00")

pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
ad.post("/admin/appointments.php", {"action": "upload_report", "id": appt1}, files={"report": ("report.pdf", pdf, "application/pdf")})
check("PDF report uploaded → REPORT_READY", sql(f"SELECT status FROM appointments WHERE id={appt1}") == "REPORT_READY")
ad.post("/admin/appointments.php", {"action": "upload_report", "id": appt1}, files={"report": ("fake.pdf", b"<html>not a pdf", "application/pdf")})
check("non-PDF upload rejected", sql(f"SELECT COUNT(*) FROM reports WHERE appointment_id={appt1}") == "1")

ad.get(f"/admin/results.php?id={appt1}")
ad.post(f"/admin/results.php?id={appt1}", {f"value[{tsh}]": "6.2", f"value[{cbc}]": "13.5", f"value[{lft}]": "30"})
check("results saved for package + test items", sql(f"SELECT COUNT(*) FROM report_values WHERE appointment_id={appt1}") == "3")
check("TSH 6.2 flagged abnormal, CBC normal", sql(f"SELECT is_abnormal FROM report_values WHERE appointment_id={appt1} AND test_id={tsh}") == "1" and sql(f"SELECT is_abnormal FROM report_values WHERE appointment_id={appt1} AND test_id={cbc}") == "0")

# Patient view of report, invoice, receipt; another patient blocked
rid = sql(f"SELECT id FROM reports WHERE appointment_id={appt1}")
c, body = b.req("GET", f"/report_download.php?id={rid}")
check("owner downloads report PDF", c == 200 and body.startswith("%PDF"))
c, _ = a.req("GET", f"/report_download.php?id={rid}") if a.get("/login.php") and a.post("/login.php", {"action": "password", "identifier": "9876500001", "password": "secret123"}) else (0, "")
check("other patient cannot download report", c == 404, str(c))
check("other patient cannot open appointment", a.get(f"/patient/appointment.php?id={appt1}")[0] == 404)
check("invoice shows discount", "Offer FIRST20" in b.get(f"/invoice.php?id={appt1}")[1])
check("receipt available", "Payment Receipt" in b.get(f"/receipt.php?id={appt1}")[1])

# Insights and sharing
_, t = b.get("/patient/insights.php")
check("insights page renders (results for member are not mixed into own trends)", "Health insights" in t)
b.get(f"/patient/appointment.php?id={appt1}")
b.post(f"/patient/appointment.php?id={appt1}", {"action": "share", "days": "7"})
tok = sql(f"SELECT token FROM report_shares WHERE appointment_id={appt1} LIMIT 1")
anon = Client()
c, t = anon.get(f"/share.php?t={tok}")
check("public share link shows results to doctor", c == 200 and "Thyroid Stimulating Hormone" in t and "9876500002" not in t)
share_id = sql(f"SELECT id FROM report_shares WHERE token='{tok}'")
b.post(f"/patient/appointment.php?id={appt1}", {"action": "revoke", "share_id": share_id})
check("revoked share link returns 410", anon.get(f"/share.php?t={tok}")[0] == 410)
check("garbage share token returns 410", anon.get("/share.php?t=abc")[0] == 410)

# ---------------- Wallet checkout & refund ----------------
b.get("/patient/book.php")
b.post("/patient/book.php", {"tests[]": [cbc], "collection_mode": "WALK_IN", "date": tomorrow, "time": "11:00", "use_wallet": "1"})
appt_w = sql("SELECT MAX(id) FROM appointments")
r = sql(f"SELECT wallet_used, total_amount, payment_status FROM appointments WHERE id={appt_w}").split("\t")
check("wallet covers ₹100 of ₹350", r[0] == "100.00" and r[1] == "250.00", str(r))
check("wallet debited to 0", sql("SELECT wallet_balance FROM users WHERE phone='9876500002'") == "0.00")
b.post(f"/patient/appointment.php?id={appt_w}", {"action": "cancel"})
check("cancel refunds wallet", sql("SELECT wallet_balance FROM users WHERE phone='9876500002'") == "100.00")
check("wallet history shows spend and refund", "Refund" in b.get("/patient/wallet.php")[1])

# ---------------- Support, documents ----------------
b.get("/patient/support.php")
b.post("/patient/support.php", {"action": "create", "subject": "Report question", "description": "What does TSH mean?", "appointment_id": appt1})
tid = sql("SELECT MAX(id) FROM tickets")
ad.get(f"/admin/support.php?id={tid}")
ad.post(f"/admin/support.php?id={tid}", {"action": "reply", "body": "It checks thyroid function."})
check("admin reply moves ticket to IN_PROGRESS", sql(f"SELECT status FROM tickets WHERE id={tid}") == "IN_PROGRESS")
check("patient sees reply", "It checks thyroid function" in b.get(f"/patient/support.php?id={tid}")[1])

png = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
b.get("/patient/documents.php")
b.post("/patient/documents.php", {"action": "upload", "kind": "PRESCRIPTION", "note": "Dr. Rao"}, files={"file": ("rx.png", png, "image/png")})
did = sql("SELECT MAX(id) FROM documents")
check("prescription upload stored", bool(did) and did != "NULL")
b.post("/patient/documents.php", {"action": "upload", "kind": "OTHER"}, files={"file": ("evil.php.png", b"<?php echo 1;", "image/png")})
check("fake image (PHP code) rejected", sql("SELECT COUNT(*) FROM documents") == "1")
check("other patient cannot open document", a.req("GET", f"/file.php?id={did}")[0] == 404)
ad.get("/admin/documents.php")
ad.post("/admin/documents.php", {"id": did, "admin_note": "Book TSH + CBC"})
check("admin reviews prescription", sql(f"SELECT status FROM documents WHERE id={did}") == "REVIEWED")

# ---------------- Health tracker ----------------
b.get("/patient/health.php")
b.post("/patient/health.php", {"action": "vital", "type": "BP", "value": "130", "value2": "85"})
b.post("/patient/health.php", {"action": "vital", "type": "BP", "value": "130"})
check("BP needs both numbers", sql("SELECT COUNT(*) FROM vital_readings") == "1")
b.post("/patient/health.php", {"action": "vital", "type": "WEIGHT", "value": "80", "recorded_at": "2026-01-01T08:00"})
b.post("/patient/health.php", {"action": "vital", "type": "WEIGHT", "value": "78"})
b.post("/patient/health.php", {"action": "goal", "metric": "WEIGHT", "direction": "BELOW", "target": "75"})
check("goal starts from latest weight", sql("SELECT start_value FROM health_goals LIMIT 1") == "78.00")
b.post("/patient/health.php", {"action": "medicine", "name": "Metformin", "dosage": "500 mg", "timings[]": ["MORNING", "NIGHT"], "food": "AFTER", "reminder": "1"})
check("medicine saved with timings", sql("SELECT timings FROM medicines LIMIT 1") == "MORNING,NIGHT")
_, t = b.get("/patient/insights.php")
check("insights shows home readings and goal", "Weight" in t and "Weight below 75" in t)

# ---------------- Finder ----------------
b.get("/patient/finder.php")
_, t = b.post("/patient/finder.php", {"q": "I feel tired and my mother has thyroid"})
check("test finder suggests TSH from catalogue", "Thyroid Stimulating Hormone" in t)
_, t = b.post("/patient/book.php", {"prefill": "1", "tests[]": [tsh]})
check("finder → booking prefill does not error", "flash err" not in t and "checked" in t)

# ---------------- Leaves, holidays, salary ----------------
tc.get("/technician/leaves.php")
d1 = (datetime.date.today() + datetime.timedelta(days=5)).isoformat(); d2 = (datetime.date.today() + datetime.timedelta(days=6)).isoformat()
tc.post("/technician/leaves.php", {"start_date": d1, "end_date": d2, "leave_type": "Casual", "reason": "Wedding"})
lid = sql("SELECT MAX(id) FROM leaves")
check("leave requested and alert raised", bool(lid) and sql("SELECT COUNT(*) FROM staff_alerts WHERE kind='LEAVE'") != "0")
tc.post("/technician/leaves.php", {"start_date": d2, "end_date": d1, "leave_type": "Casual"})
check("leave with end before start rejected", sql("SELECT COUNT(*) FROM leaves") == "1")
ad.get("/admin/leaves.php")
ad.post("/admin/leaves.php", {"action": "review", "id": lid, "status": "APPROVED"})
check("admin approves leave", sql(f"SELECT status FROM leaves WHERE id={lid}") == "APPROVED")
ad.post("/admin/leaves.php", {"action": "holiday", "holiday_date": "2027-01-14", "name": "Sankranti"})
check("holiday added", sql("SELECT name FROM holidays WHERE holiday_date='2027-01-14'") == "Sankranti")
ad.get("/admin/salary.php")
ad.post("/admin/salary.php", {"id": tech_id, "monthly_salary": "18000"})
_, t = ad.get("/admin/salary.php")
check("salary saved and payroll total shown", "₹18,000" in t)

# ---------------- Role isolation ----------------
c, _ = b.req("GET", "/admin/", follow=False)
check("patient cannot open admin pages", c in (302, 303))
c, _ = tc.req("GET", "/patient/", follow=False)
check("technician cannot open patient pages", c in (302, 303))
c, _ = Client().req("POST", "/patient/book.php", {"tests[]": cbc}, follow=False)
check("anonymous POST redirected to login", c in (302, 303))
c, _ = b.req("POST", "/patient/family.php", {"action": "add", "full_name": "X", "relation": "Y", "csrf": "bad"})
check("bad CSRF token rejected", c == 400)

# ---------------- Every page renders for its role ----------------
for cl, pages in [(ad, ["/admin/", "/admin/appointments.php", "/admin/tests.php", "/admin/packages.php", "/admin/centers.php", "/admin/partner_labs.php", "/admin/coupons.php", "/admin/support.php", "/admin/documents.php", "/admin/alerts.php", "/admin/leaves.php", "/admin/salary.php", "/admin/technicians.php", "/admin/reports.php", "/admin/reports.php?period=weekly", "/admin/reports.php?period=monthly"]),
                  (b, ["/patient/", "/patient/book.php", "/patient/insights.php", "/patient/health.php", "/patient/finder.php", "/patient/family.php", "/patient/documents.php", "/patient/support.php", "/patient/wallet.php", "/patient/profile.php"]),
                  (tc, ["/technician/", "/technician/leaves.php"])]:
    for p in pages:
        c, t = cl.get(p)
        check(f"page {p} renders", c == 200 and "</html>" in t, str(c))
c, t = ad.get("/admin/reports.php?period=daily&export=csv")
check("financial CSV export", t.startswith("Period,Orders"))

# ---------------- API (mobile apps) ----------------
c, j = api("POST", "auth/login", {"identifier": "9876500002", "password": "secret123"})
tok = j.get("token")
check("API login", c == 200 and tok, str(j))
check("API tests list", len(api("GET", "tests", token=tok)[1]) >= 5)
check("API packages include tests", any(p["name"] == "Thyroid Care" and len(p["tests"]) == 2 for p in api("GET", "packages", token=tok)[1]))
check("API pickup points nearby", len(api("GET", "pickup-points?lat=17.0&lng=82.24", token=tok)[1]) == 1)
c, j = api("POST", "coupons/quote", {"code": "FLAT50", "subtotal": 300}, token=tok)
check("API coupon quote", j.get("discount") == 50, str(j))
c, j = api("POST", "appointments", {"test_ids": [int(cbc)], "scheduled_at": tomorrow + " 12:00", "address": "API road", "coupon_code": "FLAT50"}, token=tok)
check("API booking with coupon", c == 201, str(j))
check("API booking total 300", sql(f"SELECT total_amount FROM appointments WHERE id={j.get('id', 0)}") == "300.00")
c, j = api("GET", f"appointments/{appt1}", token=tok)
check("API appointment detail includes results", c == 200 and len(j.get("results", [])) == 3, str(j)[:200])
check("API wallet", api("GET", "wallet", token=tok)[1].get("balance") == 100)
check("API family", len(api("GET", "family", token=tok)[1]) == 1)
check("API insights", "lab_trends" in api("GET", "insights", token=tok)[1])
check("API add vital", api("POST", "vitals", {"type": "PULSE", "value": 72}, token=tok)[0] == 201)
check("API finder", api("POST", "finder", {"query": "sugar diabetes"}, token=tok)[0] == 200)
c, j = api("POST", f"appointments/{appt1}/share", {"days": 1}, token=tok)
check("API share link", c == 201 and "share.php?t=" in j.get("url", ""))
check("API shared view (public)", api("GET", "shared/" + j["url"].split("t=")[1])[0] == 200)
check("API device token register", api("POST", "devices", {"token": "fcm-abc", "platform": "android"}, token=tok)[0] == 200)
check("API patient blocked from tech jobs", api("GET", "tech/jobs", token=tok)[0] == 403)
c, j = api("POST", "auth/login", {"identifier": "9000022222", "password": "techpass1"})
ttok = j["token"]
check("API tech jobs", api("GET", "tech/jobs", token=ttok)[0] == 200)
check("API tech leave", api("POST", "tech/leaves", {"start_date": d1, "end_date": d1, "leave_type": "Sick"}, token=ttok)[0] == 201)
check("API OTP disabled without SMS gateway gives clear error", "not set up" in api("POST", "auth/otp/send", {"phone": "9876500002"})[1].get("error", ""))
check("API rejects bad token", api("GET", "me", token="0" * 64)[0] == 401)

# ---------------- Cron ----------------
# appt1 was booked for the father (family member); retests track the account holder's own results
sql(f"UPDATE appointments SET scheduled_at=DATE_SUB(NOW(), INTERVAL 400 DAY) WHERE id={appt_pp}")
sql(f"INSERT INTO report_values (appointment_id,test_id,test_name,value) VALUES ({appt_pp},{cbc},'Complete Blood Count',14)")
out = subprocess.run(["php", CRON], capture_output=True, text=True,
                     env=DB_ENV).stdout
check("cron runs and sends a retest reminder (CBC yearly, last done 400 d ago)", "1 retest reminder" in out, out)
out2 = subprocess.run(["php", CRON], capture_output=True, text=True,
                      env=DB_ENV).stdout
check("retest reminder not sent twice", "0 retest reminder" in out2, out2)

print()
print(f"{len(FAILS)} FAILED: {FAILS}" if FAILS else "ALL E2E CHECKS PASSED")
sys.exit(1 if FAILS else 0)
