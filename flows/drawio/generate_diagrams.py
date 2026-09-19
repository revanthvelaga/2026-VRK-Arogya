#!/usr/bin/env python3
"""
Generates editable draw.io (.drawio, mxGraph XML) diagrams plus matching
static .svg previews (same layout/colors, so the SVG is a faithful preview
of what opening the .drawio file shows) for:
  - one "request trace" diagram per API module: URI -> Guards -> Request
    DTO -> Controller -> Service -> Repository (DAO) -> Entity (POJO) ->
    Response, one row per endpoint. The DAO/POJO split mirrors a typical
    Spring Boot Controller -> Service -> DAO -> POJO flow: TypeORM's
    Repository<Entity> IS the DAO, and an @Entity()-decorated class IS
    the POJO — this project just injects the Repository straight into
    the Service instead of through a separate hand-written DAO class.
  - one infrastructure/deployment diagram (client -> firewall -> LB ->
    API -> DB/S3/FCM/SMS, plus the CI/CD path)

Regenerate after changing an endpoint's guards/DTO/route, or adding a new
one: edit the relevant *_ENDPOINTS list (or the infra layout) below, then
run: python3 flows/drawio/generate_diagrams.py
"""
import os
import uuid
import xml.sax.saxutils as sx

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
COLORS = {
    "uri":        ("#dae8fc", "#6c8ebf", "#1a3c6e"),
    "guard":      ("#f8cecc", "#b85450", "#7c1f1a"),
    "guard_none": ("#f5f5f5", "#999999", "#666666"),
    "dto":        ("#fff2cc", "#d6b656", "#7a5b00"),
    "dto_none":   ("#f5f5f5", "#999999", "#666666"),
    "controller": ("#d5e8d4", "#82b366", "#274d19"),
    "service":    ("#e1d5e7", "#9673a6", "#4a2f57"),
    "repo":       ("#ffe6cc", "#d79b00", "#7a4900"),
    "entity":     ("#f5deff", "#a366cc", "#5a1f80"),
    "response":   ("#d0e0e3", "#10739e", "#0b425a"),
    "header":     ("#f0f0f0", "#333333", "#111111"),
    "client":     ("#dae8fc", "#6c8ebf", "#1a3c6e"),
    "edge_sec":   ("#f8cecc", "#b85450", "#7c1f1a"),
    "app":        ("#d5e8d4", "#82b366", "#274d19"),
    "data":       ("#ffe6cc", "#d79b00", "#7a4900"),
    "ext":        ("#e1d5e7", "#9673a6", "#4a2f57"),
    "cicd":       ("#fff2cc", "#d6b656", "#7a5b00"),
}

COLUMNS = [
    "URI", "Guards", "Request DTO", "Controller", "Service",
    "Repository (DAO)", "Entity (POJO)", "Response",
]
COL_WIDTHS = [220, 190, 190, 210, 210, 210, 210, 210]
COL_GAP = 26
ROW_HEIGHT = 82
ROW_PITCH = 122
MARGIN_X = 40
HEADER_Y = 60
FIRST_ROW_Y = HEADER_Y + 40 + 30


def col_x():
    xs = [MARGIN_X]
    for i in range(1, len(COL_WIDTHS)):
        xs.append(xs[-1] + COL_WIDTHS[i - 1] + COL_GAP)
    return xs


COL_X = col_x()
TOTAL_WIDTH = COL_X[-1] + COL_WIDTHS[-1] + MARGIN_X


def esc(s):
    return sx.escape(s, {'"': "&quot;"})


class DrawioDoc:
    def __init__(self, name):
        self.name = name
        self.cells = []
        self._id = 2  # 0 and 1 are reserved root cells

    def next_id(self):
        self._id += 1
        return f"n{self._id}"

    def box(self, x, y, w, h, label, fill, stroke, font, font_size=12, bold=False, align="center", rounded=1):
        cid = self.next_id()
        style = (
            f"rounded={rounded};whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
            f"fontColor={font};fontSize={font_size};align={align};verticalAlign=middle;spacing=6;"
        )
        if bold:
            style += "fontStyle=1;"
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" /></mxCell>'
        )
        return cid

    def text(self, x, y, w, h, label, font_size=16, bold=True, align="left", color="#111111"):
        cid = self.next_id()
        style = (
            f"text;html=1;align={align};verticalAlign=middle;fontSize={font_size};fontColor={color};"
        )
        if bold:
            style += "fontStyle=1;"
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(label)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" /></mxCell>'
        )
        return cid

    def edge(self, src, dst, label="", dashed=False, color="#666666"):
        cid = self.next_id()
        style = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;elbow=vertical;strokeColor=%s;strokeWidth=1.5;" % color
        if dashed:
            style += "dashed=1;"
        lbl = f' value="{esc(label)}"' if label else ""
        self.cells.append(
            f'<mxCell id="{cid}"{lbl} style="{style}" edge="1" parent="1" source="{src}" target="{dst}">'
            f'<mxGeometry relative="1" as="geometry" /></mxCell>'
        )
        return cid

    def render(self, width, height):
        # Deterministic, not random — so re-running the generator with no
        # real changes doesn't produce a diff full of nothing but a new id.
        doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"arogya-diagram:{self.name}"))
        body = "\n        ".join(self.cells)
        return f'''<mxfile host="app.diagrams.net" agent="arogya-diagram-generator" version="24.0.0">
  <diagram name="{esc(self.name)}" id="{doc_id}">
    <mxGraphModel dx="1400" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{width}" pageHeight="{height}" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        {body}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
'''


class SvgDoc:
    """Mirrors DrawioDoc's layout so the .svg preview matches the .drawio file."""

    def __init__(self):
        self.shapes = []
        self.boxes = {}  # id -> (x, y, w, h) for edge routing
        self._id = 2

    def next_id(self):
        self._id += 1
        return f"n{self._id}"

    def box(self, x, y, w, h, label, fill, stroke, font, font_size=12, bold=False, align="center", rounded=1):
        cid = self.next_id()
        self.boxes[cid] = (x, y, w, h)
        rx = 8 if rounded else 0
        lines = label.replace("<br/>", "\n").replace("<br>", "\n").split("\n")
        weight = "bold" if bold else "normal"
        anchor = {"center": "middle", "left": "start"}.get(align, "middle")
        tx = x + w / 2 if align == "center" else x + 10
        n = len(lines)
        line_h = font_size + 4
        start_y = y + h / 2 - (n - 1) * line_h / 2 + font_size / 3
        text_spans = "".join(
            f'<tspan x="{tx}" y="{start_y + i * line_h:.1f}">{sx.escape(ln)}</tspan>'
            for i, ln in enumerate(lines)
        )
        self.shapes.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" ry="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="1.5" />'
            f'<text font-family="Helvetica,Arial,sans-serif" font-size="{font_size}" '
            f'font-weight="{weight}" fill="{font}" text-anchor="{anchor}">{text_spans}</text>'
        )
        return cid

    def text(self, x, y, w, h, label, font_size=16, bold=True, align="left", color="#111111"):
        weight = "bold" if bold else "normal"
        anchor = {"left": "start", "center": "middle"}.get(align, "start")
        tx = x if align == "left" else x + w / 2
        ty = y + h / 2 + font_size / 3
        self.shapes.append(
            f'<text x="{tx}" y="{ty}" font-family="Helvetica,Arial,sans-serif" font-size="{font_size}" '
            f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{sx.escape(label)}</text>'
        )

    def edge(self, src, dst, label="", dashed=False, color="#666666"):
        sx_, sy_, sw_, sh_ = self.boxes[src]
        dx_, dy_, dw_, dh_ = self.boxes[dst]
        s_cy, d_cy = sy_ + sh_ / 2, dy_ + dh_ / 2
        same_row = abs(s_cy - d_cy) < 5
        dash = ' stroke-dasharray="6,4"' if dashed else ""
        if same_row:
            x1, y1 = sx_ + sw_, s_cy
            x2, y2 = dx_, d_cy
            path = f"M {x1} {y1} L {x2} {y2}"
        elif s_cy < d_cy:
            # src above dst: bottom-mid of src -> top-mid of dst
            x1, y1 = sx_ + sw_ / 2, sy_ + sh_
            x2, y2 = dx_ + dw_ / 2, dy_
            midy = (y1 + y2) / 2
            path = f"M {x1} {y1} L {x1} {midy} L {x2} {midy} L {x2} {y2}"
        else:
            # src below dst: top-mid of src -> bottom-mid of dst
            x1, y1 = sx_ + sw_ / 2, sy_
            x2, y2 = dx_ + dw_ / 2, dy_ + dh_
            midy = (y1 + y2) / 2
            path = f"M {x1} {y1} L {x1} {midy} L {x2} {midy} L {x2} {y2}"
        self.shapes.append(
            f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.5" marker-end="url(#arrow)"{dash} />'
        )
        if label:
            clean_label = label.replace("<br/>", " ").replace("<br>", " ")
            lx = (x1 + x2) / 2
            ly = (y1 + y2) / 2 - 6
            self.shapes.append(
                f'<text x="{lx}" y="{ly}" font-family="Helvetica,Arial,sans-serif" font-size="10" '
                f'fill="{color}" text-anchor="middle">{sx.escape(clean_label)}</text>'
            )

    def render(self, width, height):
        body = "\n  ".join(self.shapes)
        return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="Helvetica,Arial,sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#666666" />
    </marker>
  </defs>
  <rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff" />
  {body}
</svg>
'''


def build_trace_diagram(module_title, endpoints, out_basename):
    """endpoints: list of dicts with keys method, uri, guard, dto, controller,
    service, repo, entity, response. `repo` = the Repository/DAO call,
    `entity` = which Entity (POJO) it maps to and which table(s)."""
    height = FIRST_ROW_Y + len(endpoints) * ROW_PITCH + 40
    width = TOTAL_WIDTH

    for DocClass, ext in ((DrawioDoc, "drawio"), (SvgDoc, "svg")):
        doc = DocClass(module_title) if DocClass is DrawioDoc else DocClass()
        doc.text(MARGIN_X, 10, width - 2 * MARGIN_X, 30, module_title, font_size=18, bold=True)

        for i, colname in enumerate(COLUMNS):
            fill, stroke, font = COLORS["header"]
            doc.box(COL_X[i], HEADER_Y, COL_WIDTHS[i], 34, colname, fill, stroke, font, font_size=12, bold=True)

        for row, ep in enumerate(endpoints):
            y = FIRST_ROW_Y + row * ROW_PITCH
            uri_label = f"{ep['method']} {ep['uri']}"
            f1, s1, c1 = COLORS["uri"]
            id_uri = doc.box(COL_X[0], y, COL_WIDTHS[0], ROW_HEIGHT, uri_label, f1, s1, c1, bold=True)

            guard_key = "guard_none" if ep["guard"].lower().startswith("public") or ep["guard"].lower() == "none" else "guard"
            f2, s2, c2 = COLORS[guard_key]
            id_guard = doc.box(COL_X[1], y, COL_WIDTHS[1], ROW_HEIGHT, ep["guard"], f2, s2, c2)

            dto_key = "dto_none" if ep["dto"].lower() in ("none", "—", "-") else "dto"
            f3, s3, c3 = COLORS[dto_key]
            id_dto = doc.box(COL_X[2], y, COL_WIDTHS[2], ROW_HEIGHT, ep["dto"], f3, s3, c3)

            f4, s4, c4 = COLORS["controller"]
            id_ctrl = doc.box(COL_X[3], y, COL_WIDTHS[3], ROW_HEIGHT, ep["controller"], f4, s4, c4)

            f5, s5, c5 = COLORS["service"]
            id_svc = doc.box(COL_X[4], y, COL_WIDTHS[4], ROW_HEIGHT, ep["service"], f5, s5, c5)

            f6, s6, c6 = COLORS["repo"]
            id_repo = doc.box(COL_X[5], y, COL_WIDTHS[5], ROW_HEIGHT, ep["repo"], f6, s6, c6)

            f7, s7, c7 = COLORS["entity"]
            id_entity = doc.box(COL_X[6], y, COL_WIDTHS[6], ROW_HEIGHT, ep["entity"], f7, s7, c7)

            f8, s8, c8 = COLORS["response"]
            id_resp = doc.box(COL_X[7], y, COL_WIDTHS[7], ROW_HEIGHT, ep["response"], f8, s8, c8)

            doc.edge(id_uri, id_guard)
            doc.edge(id_guard, id_dto)
            doc.edge(id_dto, id_ctrl)
            doc.edge(id_ctrl, id_svc)
            doc.edge(id_svc, id_repo)
            doc.edge(id_repo, id_entity)
            doc.edge(id_entity, id_resp)

        out_path = os.path.join(OUT_DIR, f"{out_basename}.{ext}")
        with open(out_path, "w") as f:
            f.write(doc.render(width, height))
        print("wrote", out_path)


# ---------------------------------------------------------------------------
# Endpoint data
# ---------------------------------------------------------------------------

AUTH_ENDPOINTS = [
    dict(method="POST", uri="/auth/register", guard="Public — no guard",
         dto="RegisterDto<br/>(class-validator)",
         controller="AuthController<br/>.register()",
         service="AuthService.register()<br/>→ UsersService.create()<br/>(bcrypt hash password)",
         repo="usersRepo.findOne()<br/>usersRepo.create()<br/>usersRepo.save()",
         entity="User (POJO)<br/>@Entity('users')<br/>→ users table",
         response="201 Created<br/>{accessToken,<br/>refreshToken, role}"),
    dict(method="POST", uri="/auth/login", guard="Public — no guard",
         dto="LoginDto",
         controller="AuthController<br/>.login()",
         service="AuthService.login()<br/>→ UsersService<br/>.findByPhone() +<br/>.validatePassword()",
         repo="usersRepo.findOne()",
         entity="User (POJO)<br/>@Entity('users')<br/>→ users table",
         response="200 OK<br/>{accessToken,<br/>refreshToken, role}<br/>or 401"),
]

CATALOG_ENDPOINTS = [
    dict(method="GET", uri="/catalog/tests", guard="Public — no guard", dto="none",
         controller="TestsController<br/>.findAll()", service="TestsService<br/>.findAllActive()",
         repo="testsRepo.find()<br/>{where: isActive}",
         entity="Test (POJO)<br/>@Entity('tests')<br/>→ tests table",
         response="200 OK<br/>Test[]"),
    dict(method="GET", uri="/catalog/tests/:id", guard="Public — no guard", dto="none (Param id)",
         controller="TestsController<br/>.findOne()", service="TestsService<br/>.findOne()",
         repo="testsRepo.findOne()<br/>{where: id}",
         entity="Test (POJO)<br/>→ tests table",
         response="200 OK Test<br/>or 404"),
    dict(method="POST", uri="/catalog/tests", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreateTestDto", controller="TestsController<br/>.create()",
         service="TestsService<br/>.create()",
         repo="testsRepo.create(dto)<br/>testsRepo.save()",
         entity="Test (POJO)<br/>→ tests table (INSERT)",
         response="201 Created<br/>Test"),
    dict(method="PATCH", uri="/catalog/tests/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="UpdateTestDto<br/>(PartialType)", controller="TestsController<br/>.update()",
         service="TestsService<br/>.update()",
         repo="testsRepo.findOne()<br/>testsRepo.save()",
         entity="Test (POJO)<br/>→ tests table (UPDATE)",
         response="200 OK Test"),
    dict(method="DELETE", uri="/catalog/tests/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="none", controller="TestsController<br/>.remove()",
         service="TestsService<br/>.remove()<br/>(soft delete)",
         repo="testsRepo.findOne()<br/>testsRepo.save()",
         entity="Test (POJO)<br/>→ tests.is_active=false",
         response="200 OK"),
    dict(method="GET", uri="/catalog/packages", guard="Public — no guard", dto="none",
         controller="PackagesController<br/>.findAll()", service="PackagesService<br/>.findAllActive()",
         repo="packagesRepo.find()<br/>{relations: ['tests']}",
         entity="Package (POJO)<br/>@Entity('packages')<br/>→ packages,<br/>package_tests, tests",
         response="200 OK<br/>Package[]"),
    dict(method="GET", uri="/catalog/packages/:id", guard="Public — no guard", dto="none",
         controller="PackagesController<br/>.findOne()", service="PackagesService<br/>.findOne()",
         repo="packagesRepo.findOne()<br/>{relations: ['tests']}",
         entity="Package (POJO)<br/>→ packages,<br/>package_tests, tests",
         response="200 OK Package<br/>or 404"),
    dict(method="POST", uri="/catalog/packages", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreatePackageDto<br/>(incl. testIds[])", controller="PackagesController<br/>.create()",
         service="PackagesService<br/>.create()<br/>(resolves testIds)",
         repo="testsRepo.findBy();<br/>packagesRepo.create()<br/>+save()",
         entity="Test + Package<br/>(POJOs) → tests,<br/>packages, package_tests",
         response="201 Created<br/>Package"),
    dict(method="PATCH", uri="/catalog/packages/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="UpdatePackageDto", controller="PackagesController<br/>.update()",
         service="PackagesService<br/>.update()",
         repo="packagesRepo.findOne()<br/>+save(); testsRepo<br/>.findBy() if testIds sent",
         entity="Package (POJO)<br/>→ packages,<br/>package_tests",
         response="200 OK Package"),
    dict(method="DELETE", uri="/catalog/packages/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="none", controller="PackagesController<br/>.remove()",
         service="PackagesService<br/>.remove()<br/>(soft delete)",
         repo="packagesRepo.findOne()<br/>+save()",
         entity="Package (POJO)<br/>→ packages.is_active<br/>=false",
         response="200 OK"),
]

CENTERS_ENDPOINTS = [
    dict(method="GET", uri="/centers", guard="Public — no guard", dto="none",
         controller="CentersController<br/>.findAll()", service="CentersService<br/>.findAllActive()",
         repo="centersRepo.find()<br/>{where: isActive}",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers table",
         response="200 OK<br/>DiagnosticCenter[]"),
    dict(method="GET", uri="/centers/nearby<br/>?lat=&lng=", guard="Public — no guard",
         dto="NearbyQueryDto<br/>(lat, lng)", controller="CentersController<br/>.findNearby()",
         service="CentersService<br/>.findNearby()",
         repo="centersRepo<br/>.createQueryBuilder()<br/>ST_DWithin/ST_Distance",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers table",
         response="200 OK<br/>nearest-first"),
    dict(method="GET", uri="/centers/:id", guard="Public — no guard", dto="none",
         controller="CentersController<br/>.findOne()", service="CentersService<br/>.findOne()",
         repo="centersRepo.findOne()<br/>{where: id}",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers table",
         response="200 OK<br/>or 404"),
    dict(method="POST", uri="/centers", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreateCenterDto<br/>(lat/lng → GeoPoint)",
         controller="CentersController<br/>.create()", service="CentersService<br/>.create()",
         repo="centersRepo.create()<br/>centersRepo.save()",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers (INSERT, geography)",
         response="201 Created"),
    dict(method="PATCH", uri="/centers/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="UpdateCenterDto", controller="CentersController<br/>.update()",
         service="CentersService<br/>.update()",
         repo="centersRepo.findOne()<br/>centersRepo.save()",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers table",
         response="200 OK"),
    dict(method="DELETE", uri="/centers/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="none", controller="CentersController<br/>.remove()",
         service="CentersService<br/>.remove()<br/>(soft delete)",
         repo="centersRepo.findOne()<br/>centersRepo.save()",
         entity="DiagnosticCenter<br/>(POJO) → diagnostic_<br/>centers.is_active=false",
         response="200 OK"),
]

PICKUP_ENDPOINTS = [
    dict(method="GET", uri="/pickup-points/nearby<br/>?lat=&lng=&radiusKm=", guard="Public — no guard",
         dto="NearbyQueryDto", controller="PickupPointsController<br/>.findNearby()",
         service="PickupPointsService<br/>.findNearby()",
         repo="pickupPointsRepo<br/>.createQueryBuilder()<br/>ST_DWithin/ST_Distance",
         entity="PickupPoint (POJO)<br/>→ pickup_points table",
         response="200 OK<br/>nearest-first,<br/>+ distanceKm"),
    dict(method="GET", uri="/pickup-points<br/>?centerId=", guard="Public — no guard",
         dto="none (Query)", controller="PickupPointsController<br/>.findForCenter()",
         service="PickupPointsService<br/>.findAllForCenter()",
         repo="pickupPointsRepo<br/>.find() {where:<br/>centerId, isActive}",
         entity="PickupPoint (POJO)<br/>→ pickup_points table",
         response="200 OK<br/>PickupPoint[]"),
    dict(method="GET", uri="/pickup-points/:id", guard="Public — no guard", dto="none",
         controller="PickupPointsController<br/>.findOne()", service="PickupPointsService<br/>.findOne()",
         repo="pickupPointsRepo<br/>.findOne() {where: id}",
         entity="PickupPoint (POJO)<br/>→ pickup_points table",
         response="200 OK<br/>or 404"),
    dict(method="GET", uri="/pickup-points/:id<br/>/schedules", guard="Public — no guard", dto="none",
         controller="PickupPointsController<br/>.getSchedules()",
         service="PickupPointsService<br/>.getSchedules()",
         repo="schedulesRepo.find()<br/>{where: pickupPointId}",
         entity="PickupPointSchedule<br/>(POJO) → pickup_point_<br/>schedules table",
         response="200 OK<br/>Schedule[]"),
    dict(method="POST", uri="/pickup-points", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreatePickupPointDto", controller="PickupPointsController<br/>.create()",
         service="PickupPointsService<br/>.create()<br/>(radius check via<br/>ST_Distance)",
         repo="centersRepo.findOne();<br/>pickupPointsRepo<br/>.create()+save()",
         entity="DiagnosticCenter +<br/>PickupPoint (POJOs)<br/>→ pickup_points table",
         response="201 Created<br/>or 400 (outside<br/>service radius)"),
    dict(method="PATCH", uri="/pickup-points/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="UpdatePickupPointDto", controller="PickupPointsController<br/>.update()",
         service="PickupPointsService<br/>.update()<br/>(re-checks radius<br/>if location changes)",
         repo="pickupPointsRepo<br/>.findOne()+save();<br/>centersRepo.findOne()",
         entity="PickupPoint (POJO)<br/>→ pickup_points table",
         response="200 OK<br/>or 400"),
    dict(method="DELETE", uri="/pickup-points/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="none", controller="PickupPointsController<br/>.remove()",
         service="PickupPointsService<br/>.remove()<br/>(soft delete)",
         repo="pickupPointsRepo<br/>.findOne()+save()",
         entity="PickupPoint (POJO)<br/>→ pickup_points<br/>.is_active=false",
         response="200 OK"),
    dict(method="POST", uri="/pickup-points/:id<br/>/schedules", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreateScheduleDto", controller="PickupPointsController<br/>.addSchedule()",
         service="PickupPointsService<br/>.addSchedule()",
         repo="schedulesRepo<br/>.create()+save()",
         entity="PickupPointSchedule<br/>(POJO) → pickup_point_<br/>schedules table",
         response="201 Created"),
    dict(method="DELETE", uri="/pickup-points<br/>/schedules/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="none", controller="PickupPointsController<br/>.removeSchedule()",
         service="PickupPointsService<br/>.removeSchedule()",
         repo="schedulesRepo<br/>.delete(id)",
         entity="PickupPointSchedule<br/>(POJO) → pickup_point_<br/>schedules table",
         response="200 OK<br/>or 404"),
]

BOOKINGS_ENDPOINTS = [
    dict(method="POST", uri="/bookings", guard="JwtAuthGuard<br/>(any logged-in user)",
         dto="CreateBookingDto<br/>(items[], centerId,<br/>collectionMode,<br/>scheduledAt)",
         controller="BookingsController<br/>.create()",
         service="BookingsService.create()<br/>→ Centers/PickupPoints/<br/>Tests/PackagesService<br/>(validate + price)",
         repo="manager.create()+save()<br/>(1 DB transaction)",
         entity="Booking + BookingItem<br/>(POJOs) → bookings,<br/>booking_items tables",
         response="201 Created<br/>or 400/404"),
    dict(method="GET", uri="/bookings/mine", guard="JwtAuthGuard<br/>(any logged-in user)",
         dto="none", controller="BookingsController<br/>.findMine()",
         service="BookingsService<br/>.findAllForCustomer()",
         repo="bookingsRepo.find()<br/>{where: customerId,<br/>relations: ['items']}",
         entity="Booking + BookingItem<br/>(POJOs) → bookings,<br/>booking_items tables",
         response="200 OK<br/>Booking[]"),
    dict(method="GET", uri="/bookings", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="none", controller="BookingsController<br/>.findAll()",
         service="BookingsService<br/>.findAll()",
         repo="bookingsRepo.find()<br/>{relations: ['items']}",
         entity="Booking + BookingItem<br/>(POJOs) → bookings,<br/>booking_items tables",
         response="200 OK<br/>Booking[]"),
    dict(method="GET", uri="/bookings/:id", guard="JwtAuthGuard<br/>(owner or ADMIN/STAFF)",
         dto="none", controller="BookingsController<br/>.findOne()",
         service="BookingsService<br/>.findOneForUser()",
         repo="bookingsRepo.findOne()<br/>{where: id}",
         entity="Booking (POJO)<br/>→ bookings table",
         response="200 OK, 403<br/>(not owner), or 404"),
    dict(method="PATCH", uri="/bookings/:id<br/>/cancel", guard="JwtAuthGuard<br/>(owner or ADMIN/STAFF)",
         dto="none", controller="BookingsController<br/>.cancel()",
         service="BookingsService<br/>.cancel()",
         repo="bookingsRepo.findOne()<br/>bookingsRepo.save()",
         entity="Booking (POJO)<br/>→ bookings.status=<br/>CANCELLED",
         response="200 OK<br/>or 400 (bad state)"),
    dict(method="PATCH", uri="/bookings/:id<br/>/status", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="UpdateBookingStatusDto",
         controller="BookingsController<br/>.updateStatus()",
         service="BookingsService<br/>.updateStatus()",
         repo="bookingsRepo.findOne()<br/>bookingsRepo.save()",
         entity="Booking (POJO)<br/>→ bookings.status",
         response="200 OK"),
]

SAMPLES_ENDPOINTS = [
    dict(method="POST", uri="/bookings/:bookingId<br/>/samples", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="none",
         controller="SamplesController<br/>.initialize()",
         service="SamplesService<br/>.initializeForBooking()<br/>→ BookingsService<br/>.findOne()",
         repo="manager.create()+save()<br/>(1 DB transaction)",
         entity="Sample + SampleStatus-<br/>History (POJOs) → samples,<br/>sample_status_history",
         response="201 Created<br/>or 400 (already exists)"),
    dict(method="GET", uri="/bookings/:bookingId<br/>/samples", guard="JwtAuthGuard<br/>(owner or ADMIN/STAFF)",
         dto="none",
         controller="SamplesController<br/>.findForBooking()",
         service="SamplesService<br/>.findForBooking()<br/>→ BookingsService<br/>.findOneForUser()",
         repo="samplesRepo.find()<br/>{where: bookingId}",
         entity="Sample (POJO)<br/>→ samples table",
         response="200 OK<br/>Sample[]"),
    dict(method="PATCH", uri="/samples/:id<br/>/status", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="UpdateSampleStatusDto<br/>(status, notes?,<br/>partnerLabId?,<br/>turnaroundHoursOverride?)",
         controller="SamplesController<br/>.updateStatus()",
         service="SamplesService<br/>.updateStatus()<br/>→ PartnerLabsService<br/>.findOne() if routing",
         repo="manager.save(Sample)<br/>+save(History)<br/>(1 DB transaction)",
         entity="Sample + SampleStatus-<br/>History (POJOs) → samples,<br/>sample_status_history",
         response="200 OK or 400<br/>(illegal transition)"),
    dict(method="GET", uri="/samples/:id<br/>/history", guard="JwtAuthGuard<br/>(owner or ADMIN/STAFF)",
         dto="none",
         controller="SamplesController<br/>.history()",
         service="SamplesService<br/>.getHistory()<br/>→ BookingsService<br/>.findOneForUser()",
         repo="historyRepo.find()<br/>{where: sampleId}",
         entity="SampleStatusHistory<br/>(POJO) → sample_status_<br/>history table",
         response="200 OK<br/>SampleStatusHistory[]"),
    dict(method="GET", uri="/partner-labs<br/>/:partnerLabId/sla", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="none",
         controller="SamplesController<br/>.slaSummary()",
         service="SamplesService.getSla-<br/>SummaryForPartnerLab()<br/>→ PartnerLabsService<br/>.findOne()",
         repo="samplesRepo.find() +<br/>historyRepo.findOne()<br/>per sample (read-only)",
         entity="Sample + SampleStatus-<br/>History (POJOs), classified<br/>not persisted",
         response="200 OK<br/>{summary, samples[]}"),
]

PARTNER_LABS_ENDPOINTS = [
    dict(method="GET", uri="/partner-labs", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="none",
         controller="PartnerLabsController<br/>.findAll()",
         service="PartnerLabsService<br/>.findAll()",
         repo="partnerLabsRepo.find()",
         entity="PartnerLab (POJO)<br/>→ partner_labs table",
         response="200 OK<br/>PartnerLab[]"),
    dict(method="GET", uri="/partner-labs/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN,STAFF)",
         dto="none",
         controller="PartnerLabsController<br/>.findOne()",
         service="PartnerLabsService<br/>.findOne()",
         repo="partnerLabsRepo<br/>.findOne()",
         entity="PartnerLab (POJO)<br/>→ partner_labs table",
         response="200 OK<br/>or 404"),
    dict(method="POST", uri="/partner-labs", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="CreatePartnerLabDto<br/>(name, city?,<br/>contactPhone?,<br/>defaultTurnaroundHours?)",
         controller="PartnerLabsController<br/>.create()",
         service="PartnerLabsService<br/>.create()",
         repo="partnerLabsRepo<br/>.create()+save()",
         entity="PartnerLab (POJO)<br/>→ partner_labs table",
         response="201 Created"),
    dict(method="PATCH", uri="/partner-labs/:id", guard="JwtAuthGuard +<br/>RolesGuard(ADMIN)",
         dto="UpdatePartnerLabDto<br/>(all fields optional)",
         controller="PartnerLabsController<br/>.update()",
         service="PartnerLabsService<br/>.update()",
         repo="partnerLabsRepo<br/>.findOne()+save()",
         entity="PartnerLab (POJO)<br/>→ partner_labs table",
         response="200 OK<br/>or 404"),
]

build_trace_diagram("Auth module — request trace (URI → Guard → DTO → Controller → Service → Repository/DAO → Entity/POJO → Response)", AUTH_ENDPOINTS, "01-auth-trace")
build_trace_diagram("Catalog module — request trace", CATALOG_ENDPOINTS, "02-catalog-trace")
build_trace_diagram("Centers module — request trace", CENTERS_ENDPOINTS, "03-centers-trace")
build_trace_diagram("Pickup-points module — request trace", PICKUP_ENDPOINTS, "04-pickup-points-trace")
build_trace_diagram("Bookings module — request trace", BOOKINGS_ENDPOINTS, "05-bookings-trace")
build_trace_diagram("Samples module — request trace", SAMPLES_ENDPOINTS, "07-samples-trace")
build_trace_diagram("Partner-labs module — request trace", PARTNER_LABS_ENDPOINTS, "08-partner-labs-trace")

print("all trace diagrams written")


# ---------------------------------------------------------------------------
# Infrastructure / deployment diagram (custom layout, not a row grid)
# ---------------------------------------------------------------------------

def build_infra_diagram():
    width, height = 1460, 940

    for DocClass, ext in ((DrawioDoc, "drawio"), (SvgDoc, "svg")):
        doc = DocClass("Infrastructure & deployment") if DocClass is DrawioDoc else DocClass()

        doc.text(40, 10, width - 80, 30, "Infrastructure & deployment architecture", font_size=18, bold=True)

        f, s, c = COLORS["client"]
        mobile = doc.box(250, 50, 280, 70, "Customer + Staff Mobile App<br/>React Native (Expo)<br/>iOS / Android", f, s, c, bold=True)
        adminweb = doc.box(600, 50, 280, 70, "Admin Web Dashboard<br/>React (Vite)<br/>Desktop browser", f, s, c, bold=True)

        f, s, c = COLORS["edge_sec"]
        fw = doc.box(420, 170, 460, 70,
                     "Firewall / Security Group<br/>Inbound allowed: 443 (HTTPS) only<br/>80 → 443 redirect, everything else blocked",
                     f, s, c, bold=True)

        lb = doc.box(420, 290, 460, 70,
                     "Load Balancer / Reverse Proxy<br/>(Nginx, or platform-managed LB)<br/>TLS termination → routes to API",
                     f, s, c)

        f, s, c = COLORS["app"]
        api = doc.box(370, 410, 560, 90,
                      "NestJS API — Dockerized container(s)<br/>Hosted on Render / Railway / EC2<br/>Horizontally scalable, auto-restart<br/>Config via env vars / secrets manager",
                      f, s, c, bold=True, font_size=13)

        f, s, c = COLORS["edge_sec"]
        dbfw = doc.box(60, 560, 300, 60, "DB-level Firewall / Security Group<br/>Only the API's IP / SG allowed<br/>on port 5432", f, s, c)

        f, s, c = COLORS["data"]
        db = doc.box(60, 660, 300, 80, "PostgreSQL + PostGIS<br/>Managed (RDS / Supabase)<br/>Private subnet — not publicly reachable", f, s, c, bold=True)

        f, s, c = COLORS["ext"]
        s3 = doc.box(400, 560, 240, 70, "AWS S3<br/>Report PDFs, images", f, s, c)
        fcm = doc.box(680, 560, 240, 70, "Firebase Cloud Messaging<br/>Push notifications", f, s, c)
        sms = doc.box(960, 560, 240, 70, "SMS Gateway (e.g. MSG91)<br/>SMS for villagers without<br/>smartphones", f, s, c)

        f, s, c = COLORS["cicd"]
        repo = doc.box(60, 780, 220, 60, "GitHub Repo<br/>this project", f, s, c)
        actions = doc.box(320, 780, 260, 60, "GitHub Actions<br/>lint + test + build on push", f, s, c)
        deploy = doc.box(620, 780, 220, 60, "Deploy<br/>to hosting platform", f, s, c, bold=True)
        eas = doc.box(880, 780, 240, 60, "Mobile: EAS Build<br/>(Expo Application Services)", f, s, c)
        playstore = doc.box(1160, 780, 240, 60, "Google Play Store<br/>(iOS later)", f, s, c)

        # legend
        legend_items = [
            ("Client apps", "client"), ("Edge / security", "edge_sec"), ("Application", "app"),
            ("Data & storage", "data"), ("External services", "ext"), ("CI / CD", "cicd"),
        ]
        ly = 50
        for label, key in legend_items:
            f, s, c = COLORS[key]
            doc.box(1180, ly, 220, 30, label, f, s, c, font_size=11)
            ly += 40

        doc.edge(mobile, fw, color="#333333")
        doc.edge(adminweb, fw, label="HTTPS (TLS)", color="#333333")
        doc.edge(fw, lb)
        doc.edge(lb, api)
        doc.edge(api, dbfw, label="SQL over TLS")
        doc.edge(dbfw, db)
        doc.edge(api, s3, label="report/image<br/>upload-download")
        doc.edge(api, fcm, label="push")
        doc.edge(api, sms, label="SMS")

        doc.edge(repo, actions)
        doc.edge(actions, deploy)
        doc.edge(deploy, api, label="on push to main", dashed=True, color="#d6b656")
        doc.edge(eas, playstore)
        doc.text(880, 845, 480, 20, "(EAS builds apps/mobile from the same repo)", font_size=10, bold=False, color="#7a5b00")

        out_path = os.path.join(OUT_DIR, f"06-infrastructure-deployment.{ext}")
        with open(out_path, "w") as f:
            f.write(doc.render(width, height))
        print("wrote", out_path)


build_infra_diagram()
print("infra diagram written")
