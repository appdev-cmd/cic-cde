import { useEffect, useState } from "react";
import { useCdeUser } from "./AuthContext";
import { call, cloudEnabled, desktop, localDesktop } from "./bridge";
import { projectCover, projectRoles } from "./ProjectDirectory";
import type { BimModel } from "./types";
import { iso19650Roles } from "./iso19650";

const metricLabels = {
  models: "Mô hình IFC",
  elements: "Cấu kiện IFC",
  versions: "Phiên bản IFC",
  files: "Tài liệu dự án",
  cad: "Bản vẽ CAD",
};
type Metric = keyof typeof metricLabels;
type Metrics = Partial<Record<Metric, number | null>>;
const number = new Intl.NumberFormat("vi-VN");

export default function ProjectOverview({ id, name }: { id: string; name: string }) {
  const profile = useCdeUser();
  const cloudFiles = cloudEnabled && !desktop && Boolean(profile?.projectId);
  const [metrics, setMetrics] = useState<Metrics>({});

  useEffect(() => {
    const controller = new AbortController();
    const update = (values: Metrics) => {
      if (!controller.signal.aborted) setMetrics((previous) => ({ ...previous, ...values }));
    };
    void call<BimModel[]>("models.list").then(
      (models) => update({ models: models.length, elements: models.reduce((count, model) => count + model.count, 0) }),
      () => update({ models: null, elements: null }),
    );
    void call<unknown[]>("documents.list").then(
      (versions) => update({ versions: versions.length }),
      () => update({ versions: null }),
    );
    if (cloudFiles) {
      void import("./projectFileStorage").then(({ listProjectFiles }) => listProjectFiles(controller.signal)).then(
        (files) => update({ files: files.length }), () => update({ files: null }),
      );
      void import("./cadStorage").then(({ listCadWorkspace }) => listCadWorkspace(controller.signal)).then(
        ({ drawings }) => update({ cad: drawings.length }), () => update({ cad: null }),
      );
    }
    return () => controller.abort();
  }, [cloudFiles]);

  const facts = [
    ["Tên dự án", name],
    ["ID dự án", id],
    ["Không gian làm việc", cloudEnabled && !localDesktop ? "CIC CDE Cloud" : profile ? "Máy chủ dự án" : "Cục bộ"],
    ...(profile ? [
      ["Đơn vị của bạn", profile.organization],
      ["Tài khoản", profile.username],
      ["Quyền trên CIC CDE", projectRoles[profile.role] ?? profile.role],
      ...(profile.isoRole !== undefined ? [
        ["Vai trò ISO 19650", profile.isoRole ? iso19650Roles[profile.isoRole] : "Chưa xác định"],
      ] : []),
    ] : []),
  ];
  const visibleMetrics: Metric[] = cloudFiles
    ? ["models", "elements", "versions", "files", "cad"]
    : ["models", "elements", "versions"];

  return (
    <main className="project-content">
      <div className="project-page-heading"><h1>{name}</h1></div>
      <div className="project-overview">
        <img src={projectCover} alt="" />
        <section className="project-surface" aria-labelledby="project-info">
          <h2 id="project-info">Thông tin dự án</h2>
          <dl className="project-facts">
            {facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>
      </div>
      <section className="project-surface project-summary" aria-labelledby="project-summary">
        <h2 id="project-summary">Dữ liệu trong dự án</h2>
        <dl className="project-metrics">
          {visibleMetrics.map((metric) => (
            <div key={metric}>
              <dt>{metricLabels[metric]}</dt>
              <dd>{metrics[metric] === undefined ? "Đang tải…" :
                metrics[metric] === null ? "Chưa tải được" : number.format(metrics[metric])}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
