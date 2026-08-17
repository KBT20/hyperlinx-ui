import { createHash } from "node:crypto";
import JSZip from "jszip";
import { DIRS, corsHeaders, errorResponse, handleOptions, hydrateIofProjectionArtifacts, listRecords, loadRecord } from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";
import { CUSTOMER_ORGANIZATIONS, customerProjectAccessRecords } from "./customer-portal-authority.js";

const BASE = "/api/exports";
const rec = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const arr = (v) => Array.isArray(v) ? v : [];
const txt = (v, fallback = "") => String(v ?? "").trim() || fallback;
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const sha = (v) => createHash("sha256").update(v).digest("hex");
const safe = (v, fallback = "Deliverable") => txt(v, fallback).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || fallback;
const money = (v) => `$${Math.round(num(v)).toLocaleString("en-US")}`;
const station = (feet) => `${Math.floor(num(feet) / 100)}+${String(Math.round(num(feet) % 100)).padStart(2, "0")}`;
const xml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const ascii = (v) => String(v ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();

function hasPermission(user, permission) { return arr(user?.permissions).includes(permission); }
async function canExport(authority, user) {
  if (!authority || !user) return false;
  if ((!authority.organizationId || authority.organizationId === user.organizationId) && (hasPermission(user, "platform.admin") || hasPermission(user, "proposal.manage"))) return true;
  const customerOrganizationId = user.principalId === "demo-principal" ? user.demoCustomerOrganizationId : user.organizationId;
  const customerOrganization = CUSTOMER_ORGANIZATIONS[customerOrganizationId];
  if (!customerOrganization || customerOrganization.customerId !== authority.customerId) return false;
  if (user.principalId === "demo-principal" && String(user.demoPersona ?? "").startsWith("CUSTOMER_")) return true;
  const access = await customerProjectAccessRecords();
  if (!access.some((item) => item.status === "ACTIVE" && item.principalId === user.principalId && item.customerOrganizationId === customerOrganizationId &&
    (item.opportunityId === authority.opportunityId || item.proposalId === authority.proposalId))) return false;
  const assigned = arr(authority.assignedCustomerUsers ?? authority.authorizedCustomerSignerUserIds).map(String);
  return assigned.includes(String(user.userId)) || Boolean(user.customerId && String(user.customerId) === String(authority.customerId));
}

async function certifiedForProposal(proposalId) {
  return (await listRecords(DIRS.certifiedIofPackages)).find((item) => item.proposalId === proposalId) ?? null;
}

async function contextFrom({ proposal, serviceOrder, certified, scopeVersion } = {}) {
  const resolvedProposal = proposal ?? (serviceOrder?.proposalId ? await loadRecord(DIRS.proposalDrafts, serviceOrder.proposalId).catch(() => null) : null);
  const resolvedCertified = certified ?? (serviceOrder?.certifiedPackageId ? await loadRecord(DIRS.certifiedIofPackages, serviceOrder.certifiedPackageId).catch(() => null) : resolvedProposal ? await certifiedForProposal(resolvedProposal.proposalId) : null);
  const sourceId = txt(resolvedCertified?.sourceDraftPackageId ?? resolvedCertified?.certifiedDraftIofPackageId ?? resolvedProposal?.draftIofPackageId);
  const source = sourceId ? await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, sourceId).catch(() => null)) : null;
  const routeId = txt(resolvedCertified?.routeRepositoryId ?? source?.routeRepositoryId ?? resolvedProposal?.routeRepositoryId ?? serviceOrder?.routeSummary?.routeRepositoryId);
  const route = routeId ? await loadRecord(DIRS.commercialRoutes, routeId).catch(() => null) : null;
  if (!resolvedProposal || !route || arr(route.commercialGeometry).length < 2) throw Object.assign(new Error("Governed Proposal and Commercial Route Repository geometry are required for export."), { status: 409 });
  const expectedRevision = num(resolvedProposal.routeRevision ?? resolvedProposal.routeSnapshot?.routeRevision, -1);
  const expectedGeometryHash = txt(resolvedProposal.routeGeometryHash ?? resolvedProposal.routeSnapshot?.geometryHash);
  const expectedGeometryId = txt(resolvedProposal.routeGeometryId ?? resolvedProposal.routeSnapshot?.routeGeometryId);
  if (expectedRevision !== num(route.routeRevision, -2) || expectedGeometryHash !== txt(route.geometryHash) || expectedGeometryId !== txt(route.routeGeometryId)) {
    throw Object.assign(new Error("The current Commercial Route no longer matches the exact selected Proposal Revision spine. Export is blocked."), { status: 409 });
  }
  return { proposal: resolvedProposal, serviceOrder, certified: resolvedCertified, scopeVersion, source, route };
}

function endpoint(route, role) {
  const auth = rec(route.endpointAuthority);
  const value = rec(role === "A" ? auth.aSite : auth.zSite);
  const fallback = rec(role === "A" ? route.aLocation : route.zLocation);
  const coordinate = arr(value.coordinate).length >= 2 ? value.coordinate : fallback.coordinate;
  return { role, name: txt(value.siteName ?? fallback.label, `${role} Endpoint`), coordinate: arr(coordinate).slice(0, 2).map(Number), source: txt(value.coordinateSource, "COMMERCIAL_ROUTE_REPOSITORY") };
}

function quantities(context) {
  const proposal = context.proposal;
  const q = rec(proposal.constructionQuantities ?? rec(proposal.transparentEstimate).physicalQuantities);
  const config = rec(proposal.projectConfiguration ?? rec(rec(proposal.transparentEstimate).controls).projectConfiguration);
  const objects = arr(context.source?.projectedObjects ?? context.source?.projectedObjectManifest?.projectedObjects);
  const counts = {};
  for (const object of objects) { const type = txt(object.objectType ?? object.type, "OTHER").toUpperCase(); counts[type] = (counts[type] ?? 0) + 1; }
  return {
    routeFeet: num(context.route.routeFeet, num(q.routeFeet)), routeMiles: num(context.route.routeMiles, num(q.routeMiles)),
    ductCount: num(config.ductCount, 0), ductDiameter: num(config.ductDiameter, 0), ductMaterial: txt(config.ductMaterialSpec, "HDPE"),
    conduitFeet: num(q.conduitFeet), fiberCount: num(config.fiberCount ?? q.fiberCount), purchasedFiberFeet: num(q.purchasedFiberFeet),
    handholes: counts.HANDHOLE ?? num(q.handholeCount), vaults: counts.VAULT ?? num(q.vaultCount), spliceCases: counts.SPLICE_CASE ?? num(q.spliceCaseCount),
    ilaSites: (counts.ILA ?? 0) + (counts.REGEN ?? 0), markerPosts: counts.MARKER_POST ?? 0, slackLoops: counts.SLACK_LOOP ?? 0,
    objects, counts,
  };
}

function proposalPricing(proposal) {
  const terms = rec(proposal.commercialTerms);
  const facing = rec(rec(proposal.proposalContent).customerFacingPricing);
  return { nrc: num(facing.nrc ?? terms.nrc), mrc: num(facing.monthlyOm ?? terms.monthlyOm), termMonths: num(facing.termMonths ?? terms.termMonths), tcv: num(terms.totalContractValue) };
}

function wrap(value, width = 88) {
  const words = ascii(value).split(" "); const lines = []; let line = "";
  for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (candidate.length > width && line) { lines.push(line); line = word; } else line = candidate; }
  if (line) lines.push(line); return lines;
}

function pdfEscape(value) { return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function textPage(title, sections) {
  const commands = ["BT", "/F1 20 Tf", `48 748 Td (${pdfEscape(title)}) Tj`, "ET"];
  let y = 718;
  for (const section of sections) {
    if (y < 100) break;
    commands.push("BT", "/F1 12 Tf", `48 ${y} Td (${pdfEscape(section.heading)}) Tj`, "ET"); y -= 19;
    for (const sourceLine of section.lines) for (const line of wrap(sourceLine)) {
      if (y < 64) break;
      commands.push("BT", "/F1 9 Tf", `55 ${y} Td (${pdfEscape(line)}) Tj`, "ET"); y -= 13;
    }
    y -= 8;
  }
  return commands.join("\n");
}

function mapPage(title, context, q) {
  const coords = arr(context.route.commercialGeometry).map((v) => arr(v).slice(0, 2).map(Number)).filter((v) => v.length === 2 && v.every(Number.isFinite));
  const xs = coords.map((v) => v[0]), ys = coords.map((v) => v[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(500 / Math.max(maxX - minX, 0.000001), 500 / Math.max(maxY - minY, 0.000001));
  const point = ([lon, lat]) => [56 + (lon - minX) * scale, 120 + (lat - minY) * scale];
  const routeCommands = coords.map((coord, index) => { const [x, y] = point(coord); return `${x.toFixed(2)} ${y.toFixed(2)} ${index ? "l" : "m"}`; }).join("\n");
  const major = q.objects.filter((o) => /ILA|REGEN|VAULT|SPLICE/i.test(txt(o.objectType))).slice(0, 80).map((o) => arr(o.projectedCoordinate ?? o.coordinate)).filter((v) => v.length >= 2).map((coord) => { const [x,y] = point(coord); return `${(x-1.7).toFixed(2)} ${(y-1.7).toFixed(2)} 3.4 3.4 re f`; }).join("\n");
  const a = point(coords[0]), z = point(coords.at(-1));
  return [
    "BT", "/F1 20 Tf", `48 748 Td (${pdfEscape(title)}) Tj`, "ET",
    "BT", "/F1 9 Tf", `48 727 Td (${pdfEscape(`Customer export profile | Full governed route | ${q.routeMiles.toFixed(2)} miles`)}) Tj`, "ET",
    "0.08 0.35 0.62 RG", "2.4 w", routeCommands, "S", "0.85 0.35 0.12 rg", major,
    "0.1 0.55 0.2 rg", `${(a[0]-4).toFixed(2)} ${(a[1]-4).toFixed(2)} 8 8 re f`, `${(z[0]-4).toFixed(2)} ${(z[1]-4).toFixed(2)} 8 8 re f`,
    "BT", "/F1 11 Tf", `${(a[0]+7).toFixed(2)} ${(a[1]-2).toFixed(2)} Td (A) Tj`, "ET", "BT", "/F1 11 Tf", `${(z[0]+7).toFixed(2)} ${(z[1]-2).toFixed(2)} Td (Z) Tj`, "ET",
    "BT", "/F1 8 Tf", `48 78 Td (${pdfEscape(`Route Repository: ${context.route.routeRepositoryId} | Revision ${context.route.routeRevision} | Geometry ${context.route.geometryHash}`)}) Tj`, "ET",
    "BT", "/F1 8 Tf", "48 64 Td (Customer presentation profile: full route, endpoints, and major facilities; routine labels are suppressed.) Tj", "ET",
  ].join("\n");
}

function buildPdf(pages, metadata) {
  const objects = [];
  const pageIds = pages.map((_, i) => 3 + i * 2);
  const fontId = 3 + pages.length * 2;
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  pages.forEach((content, i) => {
    const pageId = pageIds[i], contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  });
  objects[fontId] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  let output = "%PDF-1.4\n%TERALINX-GOVERNED-EXPORT\n"; const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) { offsets[i] = Buffer.byteLength(output); output += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10,"0")} 00000 n `).join("\n")}\n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info << /Title (${pdfEscape(metadata.title)}) /Subject (${pdfEscape(metadata.subject)}) /Creator (Teralinx Governed Export Projection) >> >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "ascii");
}

function proposalPdf(context) {
  const p = context.proposal, q = quantities(context), price = proposalPricing(p), civil = rec(rec(p.transparentEstimate).civilMix), a = endpoint(context.route,"A"), z = endpoint(context.route,"Z");
  const config = rec(p.projectConfiguration);
  const sections = [
    ...(p.environment === "DEMO" ? [{ heading: "DEMO DOCUMENT", lines: ["Demonstration projection only. Not production eligible. Placeholder contract language is not approved Teralinx legal terms."] }] : []),
    { heading: "PROPOSAL", lines: [`Customer: ${txt(p.customerName ?? p.executiveSummary?.customer,"Customer")}`, `Opportunity: ${txt(p.title ?? p.opportunityId)}`, `Product: ${txt(p.productName ?? context.certified?.productName,"Point-to-Point Fiber Infrastructure")}`, `Proposal Revision: ${txt(p.proposalRevisionId)}`, `Proposal Date: ${txt(p.updatedAt ?? p.createdAt)}`] },
    { heading: "PROJECT OVERVIEW", lines: [`A Location: ${a.name} (${a.coordinate.join(", ")})`, `Z Location: ${z.name} (${z.coordinate.join(", ")})`, `Route Length: ${q.routeMiles.toFixed(2)} miles (${Math.round(q.routeFeet).toLocaleString("en-US")} feet)`, `Route Type: Governed commercial route alignment`] },
    { heading: "CUSTOMER SOLUTION", lines: [`${q.ductCount} x ${q.ductDiameter || config.ductDiameter || 1.25}-inch ${q.ductMaterial} ducts`, `${q.fiberCount}-count ${txt(config.fiberCableType,"shielded fiber cable")}`, `Fiber placement: ${txt(config.fiberPlacementPolicy,"BLOWN")}`, `ILA configuration: ${q.ilaSites ? `${q.ilaSites} governed facility locations` : "No certified ILA/regeneration facility objects"}`] },
    { heading: "CONSTRUCTION ASSUMPTIONS", lines: [`Civil mix: ${num(civil.plowPercent)}% plow, ${num(civil.directionalBoreDirtPercent)}% dirt bore, ${num(civil.directionalBoreRockPercent)}% rock bore, ${num(civil.openTrenchPercent)}% open trench`, `Stationing: A to Z, 0+00 through ${station(q.routeFeet)}; routine station rows omitted from this customer document.`] },
    { heading: "INFRASTRUCTURE SUMMARY", lines: [`Conduit: ${Math.round(q.conduitFeet).toLocaleString("en-US")} feet`, `Purchased fiber: ${Math.round(q.purchasedFiberFeet).toLocaleString("en-US")} feet`, `Handholes: ${q.handholes} | Vaults: ${q.vaults} | Splice cases: ${q.spliceCases}`, `Marker posts: ${q.markerPosts} | Slack loops: ${q.slackLoops} | ILA/regeneration sites: ${q.ilaSites}`] },
    { heading: "COMMERCIAL TERMS", lines: [`NRC: ${money(price.nrc)} | MRC/O&M: ${money(price.mrc)} | Term: ${price.termMonths} months | TCV: ${money(price.tcv)}`, ...arr(p.commercialAssumptions).slice(0,5).map((v) => txt(v))] },
    { heading: "REVISION / AUDIT REFERENCE", lines: [`Route Repository: ${context.route.routeRepositoryId}`, `Route Revision: ${context.route.routeRevision}`, `Customer-facing projection of the exact governed authority. Technical hashes remain in protected export metadata.`] },
  ];
  return buildPdf([textPage("TERALINX", sections.slice(0,4)), textPage("PROPOSAL - SCOPE & TERMS", sections.slice(4)), mapPage("GOVERNED OPPORTUNITY MAP", context, q)], { title: `Teralinx Proposal ${p.proposalRevisionId}`, subject: `Governed Proposal projection ${p.proposalHash}` });
}

function serviceOrderPdf(context, signature, countersignature) {
  const so = context.serviceOrder, q = quantities(context), a = endpoint(context.route,"A"), z = endpoint(context.route,"Z"), price = rec(so.pricingSummary), terms = rec(so.commercialTerms);
  const executed = Boolean(countersignature && so.scopeVersionId); const customerSigned = Boolean(signature);
  const status = executed ? "EXECUTED" : customerSigned ? "CUSTOMER SIGNED" : `${so.status} / AWAITING SIGNATURE`;
  const conditions = arr(context.source?.engineeringConstraints); const unresolved = conditions.filter((v) => !["ACCEPTED","RESOLVED"].includes(txt(v.status).toUpperCase()));
  const major = q.objects.filter((o) => /ILA|REGEN|VAULT|SPLICE/i.test(txt(o.objectType))).slice(0, 12);
  const sections = [
    ...(so.environment === "DEMO" ? [{ heading: "DEMO DOCUMENT", lines: ["Demonstration projection only. Not production eligible. Placeholder contract language is not approved Teralinx legal terms."] }] : []),
    { heading: "STATEMENT OF WORK / SERVICE ORDER", lines: [`Status: ${status}`, `Customer: ${txt(so.customer?.name,"Google")} | Opportunity: ${so.opportunityId}`, `Product: ${txt(so.serviceDescription?.productName)}`, `Service Order: ${so.serviceOrderId} | Revision ${so.documentRevision}`, `Document Hash: ${so.documentHash}`] },
    { heading: "CERTIFIED TECHNICAL BASIS", lines: [`Certified IOF: ${so.certifiedPackageId}`, `Certification date: ${txt(context.certified?.certifiedAt)}`, `Engineering Revision: ${txt(context.certified?.engineeringRevisionId)} | Approval: ${txt(context.certified?.engineeringApprovalId)}`] },
    { heading: "PROJECT OVERVIEW / SCOPE OF WORK", lines: [`A Location: ${a.name} (${a.coordinate.join(", ")})`, `Z Location: ${z.name} (${z.coordinate.join(", ")})`, `Route Length: ${q.routeMiles.toFixed(2)} miles`, `Teralinx will deliver the governed point-to-point duct and fiber infrastructure represented by the exact Certified IOF.`] },
    { heading: "INFRASTRUCTURE & QUANTITIES", lines: [`${q.ductCount} x ${q.ductDiameter}-inch ${q.ductMaterial} duct package | ${q.fiberCount}-count fiber`, `Conduit: ${Math.round(q.conduitFeet).toLocaleString("en-US")} feet | Purchased fiber: ${Math.round(q.purchasedFiberFeet).toLocaleString("en-US")} feet`, `Handholes: ${q.handholes} | Vaults: ${q.vaults} | Splice cases: ${q.spliceCases} | ILA/regeneration: ${q.ilaSites}`, `Other certified point facilities: ${q.markerPosts} marker posts and ${q.slackLoops} slack loops`] },
    { heading: "STATIONING SUMMARY", lines: [`The route is governed using linear stationing from A to Z. Station range: 0+00 through ${station(q.routeFeet)}.`, ...major.map((o) => `${txt(o.objectId)} | ${txt(o.objectType)} | Station ${txt(o.stationAddress, station(o.stationValue ?? o.measure))}`)] },
    { heading: "ENGINEERING CONDITIONS", lines: unresolved.length ? unresolved.slice(0,8).map((v) => `${txt(v.conditionTitle ?? v.category,"Condition")} | ${txt(v.status)} | ${txt(v.notesEvidence ?? v.description)}`) : ["No unresolved Engineering conditions."] },
    { heading: "COMMERCIAL TERMS / RESPONSIBILITIES", lines: [`NRC: ${money(price.nonRecurringCharge)} | MRC: ${money(price.monthlyRecurringCharge)} | Term: ${price.termMonths ?? terms.serviceTermMonths} months`, `Payment: ${txt(terms.paymentTerms)} | Change control: ${txt(terms.changeControl)}`, `Customer: provide site access, timely decisions, and responsibilities stated in the governing terms.`, `Teralinx: deliver the certified scope subject to the Service Order terms and governed change control.`] },
    { heading: "ACCEPTANCE / AUTHORIZATION", lines: [customerSigned ? `Customer signer: ${signature.signerName} (${txt(signature.signerRole,"authorized customer signer")}) | Signed: ${signature.signedAt}` : "Customer signature: NOT SIGNED", executed ? `Teralinx countersignature: ${countersignature.countersignedBy} | Countersigned: ${countersignature.countersignedAt}` : "Teralinx countersignature: NOT COUNTERSIGNED", executed ? `Execution Authority: AUTHORIZED | ScopeVersion: ${so.scopeVersionId}` : "Execution Authority: NOT AUTHORIZED | ScopeVersion: NOT CREATED"] },
  ];
  return buildPdf([textPage("TERALINX", sections.slice(0,4)), textPage("SERVICE ORDER - TERMS & AUTHORIZATION", sections.slice(4)), mapPage("CERTIFIED ROUTE MAP", context, q)], { title: `Teralinx Service Order ${so.serviceOrderId}`, subject: `Governed Service Order projection ${so.documentHash}` });
}

function dataRows(values) { return Object.entries(values).map(([name,value]) => `<Data name="${xml(name)}"><value>${xml(value)}</value></Data>`).join(""); }
function placemark(object, status) {
  const coordinate = arr(object.projectedCoordinate ?? object.coordinate); if (coordinate.length < 2) return "";
  const type = txt(object.objectType,"OTHER");
  return `<Placemark><name>${xml(object.objectId)}</name><styleUrl>#facility</styleUrl><ExtendedData>${dataRows({ ObjectID: object.objectId, ObjectType: type, Station: txt(object.stationAddress, station(object.stationValue ?? object.measure)), Latitude: coordinate[1], Longitude: coordinate[0], FacilityClass: type, CertifiedStatus: status })}</ExtendedData><Point><coordinates>${coordinate[0]},${coordinate[1]},0</coordinates></Point></Placemark>`;
}

async function kmz(context, lifecycle) {
  const q = quantities(context), route = context.route, coords = arr(route.commercialGeometry), a = endpoint(route,"A"), z = endpoint(route,"Z");
  const status = context.certified ? "CERTIFIED" : "COMMERCIAL";
  const execution = lifecycle === "AUTHORIZED" && context.scopeVersion ? "AUTHORIZED" : "NOT AUTHORIZED";
  const objects = q.objects.filter((o, i, all) => all.findIndex((x) => txt(x.objectId) === txt(o.objectId)) === i);
  const major = objects.filter((o) => /ILA|REGEN|VAULT|SPLICE/i.test(txt(o.objectType)));
  const network = objects.filter((o) => !/ILA|REGEN|VAULT|SPLICE/i.test(txt(o.objectType)));
  const conditions = arr(context.source?.engineeringConstraints).map((condition) => {
    const coordinate = arr(condition.conditionContext?.coordinates); if (coordinate.length < 2) return "";
    return `<Placemark><name>${xml(condition.conditionTitle ?? condition.category)}</name><styleUrl>#condition</styleUrl><ExtendedData>${dataRows({ Category: condition.category, Status: condition.status, Severity: condition.humanSeverity ?? condition.severity, Station: condition.station })}</ExtendedData><Point><coordinates>${coordinate[0]},${coordinate[1]},0</coordinates></Point></Placemark>`;
  }).join("");
  const stations = arr(context.source?.stations);
  const references = []; const seen = new Set();
  for (let feet = 0; feet <= q.routeFeet; feet += 5280) {
    let best = null, distance = Infinity;
    for (const item of stations) { const measure = num(item.stationFeet ?? item.measureFeet ?? item.stationValue ?? item.measuredDistanceFeet ?? item.measure); const delta = Math.abs(measure-feet); if (delta < distance) { best=item; distance=delta; } }
    if (best && !seen.has(best.stationId)) { seen.add(best.stationId); references.push(best); }
  }
  const stationKml = references.map((item) => { const measure=num(item.stationFeet ?? item.measureFeet ?? item.stationValue ?? item.measuredDistanceFeet ?? item.measure); const c=arr(item.coordinate ?? item.projectedCoordinate); return c.length<2?"":`<Placemark><name>${xml(`Mile ${Math.round(measure/5280)}`)}</name><visibility>0</visibility><ExtendedData>${dataRows({ Station: txt(item.stationLabel ?? item.stationAddress,station(measure)), ReferenceDensity:"ONE_MILE" })}</ExtendedData><Point><coordinates>${c[0]},${c[1]},0</coordinates></Point></Placemark>`; }).join("");
  const manifest = { routeRepositoryId: route.routeRepositoryId, routeRevision: route.routeRevision, geometryHash: route.geometryHash, proposalRevisionId: context.proposal.proposalRevisionId, proposalHash: context.proposal.proposalHash, certifiedIofId: context.certified?.certifiedPackageId ?? "", certificationHash: context.certified?.certificationHash ?? "", execution, scopeVersionId: execution === "AUTHORIZED" ? context.scopeVersion.scopeVersionId : "", routeMiles: q.routeMiles, exactGeometryPointCount: coords.length, stationReferenceCount: references.length, facilityPlacemarkCount: objects.length };
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(context.proposal.title ?? "Teralinx Governed Route")}</name><description>${xml(`IOF Status: ${status}; Execution: ${execution}`)}</description><ExtendedData>${dataRows(manifest)}</ExtendedData><Style id="route"><LineStyle><color>ffff7a18</color><width>4</width></LineStyle></Style><Style id="facility"><IconStyle><scale>0.7</scale></IconStyle></Style><Style id="condition"><IconStyle><color>ff00aaff</color><scale>0.8</scale></IconStyle></Style><Folder><name>PROJECT</name><Folder><name>Route</name><Placemark><name>Governed Route</name><styleUrl>#route</styleUrl><ExtendedData>${dataRows(manifest)}</ExtendedData><LineString><tessellate>1</tessellate><coordinates>${coords.map((c)=>`${c[0]},${c[1]},0`).join(" ")}</coordinates></LineString></Placemark></Folder><Folder><name>Endpoints</name>${[a,z].map((e)=>`<Placemark><name>${e.role} - ${xml(e.name)}</name><ExtendedData>${dataRows({ Endpoint:e.role,CoordinateSource:e.source })}</ExtendedData><Point><coordinates>${e.coordinate[0]},${e.coordinate[1]},0</coordinates></Point></Placemark>`).join("")}</Folder><Folder><name>Major Facilities</name>${major.map((o)=>placemark(o,status)).join("")}</Folder><Folder><name>Network Facilities</name><visibility>0</visibility>${network.map((o)=>placemark(o,status)).join("")}</Folder><Folder><name>Engineering Conditions</name>${conditions}</Folder><Folder><name>Station References</name><visibility>0</visibility>${stationKml}</Folder><Folder><name>Scope Components</name><Placemark><name>Duct Package</name><description>${xml(`${q.ductCount} x ${q.ductDiameter}-inch ${q.ductMaterial}; ${Math.round(q.conduitFeet)} conduit feet`)}</description></Placemark><Placemark><name>Fiber Cable</name><description>${xml(`${q.fiberCount}-count; ${Math.round(q.purchasedFiberFeet)} purchased fiber feet`)}</description></Placemark></Folder></Folder></Document></kml>`;
  const zip = new JSZip(); zip.file("doc.kml", kml, { date: new Date("1980-01-01T00:00:00.000Z") });
  const buffer = await zip.generateAsync({ type:"nodebuffer", compression:"DEFLATE", compressionOptions:{level:9}, platform:"DOS", streamFiles:false });
  return { buffer, manifest, kml };
}

function send(res, buffer, contentType, filename, authorityHash, extra = {}) {
  res.writeHead(200, { ...corsHeaders(), "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": buffer.length, "Cache-Control":"private, no-store", "X-Teralinx-Export-Hash":sha(buffer), "X-Teralinx-Authority-Hash":authorityHash, "X-Content-Type-Options":"nosniff", ...extra });
  res.end(buffer);
}

export async function handleCustomerExports(req, res, pathname) {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  if (handleOptions(req,res)) return true;
  if (req.method !== "GET") { errorResponse(res,405,"Customer export endpoints are read-only."); return true; }
  const user = requireRuntimeUser(req,res); if (!user) return true;
  const parts = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === "proposals" && parts[1] && parts[2] === "revisions" && parts[3] && parts[4] === "pdf") {
      const proposal = await loadRecord(DIRS.proposalDrafts,parts[1]).catch(()=>null);
      if (!proposal) { errorResponse(res,404,"Proposal not found."); return true; }
      if (!await canExport(proposal,user)) { errorResponse(res,403,"Proposal export is outside your organization/customer/opportunity scope."); return true; }
      const revision = arr(proposal.proposalRevisions).find((item) => item.proposalRevisionId === parts[3]);
      if (!revision?.snapshot || !revision?.proposalHash) { errorResponse(res,404,"Immutable Proposal Revision not found."); return true; }
      const revisionProposal = { ...proposal, ...revision.snapshot, proposalRevisionId: revision.proposalRevisionId, proposalHash: revision.proposalHash, revisionNumber: revision.revisionNumber, version: revision.revisionNumber, updatedAt: revision.createdAt };
      const context = await contextFrom({proposal:revisionProposal}); const label=safe(context.route.routeName ?? proposal.opportunityId,"Route");
      const buffer=proposalPdf(context); send(res,buffer,"application/pdf",`Teralinx_${label}_Proposal_R${num(revision.revisionNumber,1)}.pdf`,txt(revision.proposalHash),{"X-Teralinx-Proposal-Revision":revision.proposalRevisionId,"X-Teralinx-Route-Revision":String(context.route.routeRevision),"X-Teralinx-Geometry-Hash":txt(context.route.geometryHash)}); return true;
    }
    if (parts[0] === "proposals" && parts[1] && ["pdf","route.kmz"].includes(parts[2])) {
      const proposal = await loadRecord(DIRS.proposalDrafts,parts[1]).catch(()=>null);
      if (!proposal) { errorResponse(res,404,"Proposal not found."); return true; }
      if (!await canExport(proposal,user)) { errorResponse(res,403,"Proposal export is outside your organization/customer/opportunity scope."); return true; }
      const context = await contextFrom({proposal}); const label=safe(context.route.routeName ?? proposal.opportunityId,"Route");
      if (parts[2] === "pdf") { const buffer=proposalPdf(context); send(res,buffer,"application/pdf",`Teralinx_${label}_Proposal_R${num(proposal.version,1)}.pdf`,txt(proposal.proposalHash),{"X-Teralinx-Route-Revision":String(context.route.routeRevision),"X-Teralinx-Geometry-Hash":txt(context.route.geometryHash)}); return true; }
      const artifact=await kmz(context,context.scopeVersion?"AUTHORIZED":"CERTIFIED"); send(res,artifact.buffer,"application/vnd.google-earth.kmz",`Teralinx_${label}_Route_R${context.route.routeRevision}.kmz`,txt(proposal.proposalHash),{"X-Teralinx-Geometry-Hash":txt(context.route.geometryHash)}); return true;
    }
    if (parts[0] === "service-orders" && parts[1] && parts[2] === "pdf") {
      const serviceOrder=await loadRecord(DIRS.serviceOrders,parts[1]).catch(()=>null); if(!serviceOrder){errorResponse(res,404,"Service Order not found.");return true;}
      if(!await canExport(serviceOrder,user)){errorResponse(res,403,"Service Order export is outside your organization/customer/opportunity scope.");return true;}
      const context=await contextFrom({serviceOrder}); const signature=serviceOrder.customerSignatureId?await loadRecord(DIRS.customerSignatures,serviceOrder.customerSignatureId).catch(()=>null):null; const countersignature=serviceOrder.countersignatureId?await loadRecord(DIRS.teralinxCountersignatures,serviceOrder.countersignatureId).catch(()=>null):null;
      const buffer=serviceOrderPdf(context,signature,countersignature); send(res,buffer,"application/pdf",`Teralinx_${safe(context.route.routeName ?? serviceOrder.opportunityId,"Route")}_Service_Order_R${serviceOrder.documentRevision}.pdf`,serviceOrder.documentHash,{"X-Teralinx-Geometry-Hash":txt(context.route.geometryHash)}); return true;
    }
    if (["certified-iof","scopeversions"].includes(parts[0]) && parts[1] && parts[2] === "route.kmz") {
      const scopeVersion=parts[0] === "scopeversions"?await loadRecord(DIRS.scopeVersions,parts[1]).catch(()=>null):null;
      const certifiedId=parts[0] === "certified-iof"?parts[1]:txt(scopeVersion?.certifiedIofPackageId); const certified=certifiedId?await loadRecord(DIRS.certifiedIofPackages,certifiedId).catch(()=>null):null;
      if(!certified){errorResponse(res,404,"Certified IOF authority not found.");return true;} const proposal=await loadRecord(DIRS.proposalDrafts,certified.proposalId).catch(()=>null);
      if(!await canExport(proposal,user)){errorResponse(res,403,"Route export is outside your organization/customer/opportunity scope.");return true;}
      const context=await contextFrom({proposal,certified,scopeVersion}); const lifecycle=scopeVersion?"AUTHORIZED":"CERTIFIED"; const artifact=await kmz(context,lifecycle); const suffix=scopeVersion?`${safe(scopeVersion.scopeVersionId,"SV")}_Authorized_Route`:`Certified_Route`;
      send(res,artifact.buffer,"application/vnd.google-earth.kmz",`Teralinx_${safe(context.route.routeName ?? proposal.opportunityId,"Route")}_${suffix}.kmz`,scopeVersion?.executionAuthorizationCertificateId??certified.certificationHash,{"X-Teralinx-Geometry-Hash":txt(context.route.geometryHash),"X-Teralinx-Execution-State":scopeVersion?"AUTHORIZED":"NOT_AUTHORIZED"}); return true;
    }
    errorResponse(res,404,"Customer export route not found."); return true;
  } catch(error) { errorResponse(res,error.status??500,error.message??String(error)); return true; }
}
