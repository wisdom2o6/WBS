import React, { useState } from "react";

export type ExportFormat = "png" | "pdf";
export type PngBackground = "white" | "transparent";
export type PdfOrientation = "portrait" | "landscape";

export interface ExportOptions {
  format: ExportFormat;
  fileName: string;
  pngBackground: PngBackground;
  pdfSize: "a4";
  pdfOrientation: PdfOrientation;
}

interface ExportDialogProps {
  roomId: string;
  busy: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  roomId,
  busy,
  onClose,
  onExport,
}) => {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [fileName, setFileName] = useState(`whiteboard-${roomId}`);
  const [pngBackground, setPngBackground] = useState<PngBackground>("white");
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>("landscape");

  return (
    <div className="export-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="export-dialog-header">
          <h2 id="export-dialog-title">Xuất bảng vẽ</h2>
          <button type="button" className="export-dialog-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        <label>
          Định dạng
          <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
            <option value="png">PNG</option>
            <option value="pdf">PDF</option>
          </select>
        </label>

        <label>
          Tên file
          <input
            type="text"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            placeholder={`whiteboard-${roomId}`}
          />
        </label>

        {format === "png" ? (
          <label>
            Nền PNG
            <select
              value={pngBackground}
              onChange={(event) => setPngBackground(event.target.value as PngBackground)}
            >
              <option value="white">Trắng</option>
              <option value="transparent">Trong suốt</option>
            </select>
          </label>
        ) : (
          <>
            <label>
              Khổ giấy
              <select value="a4" disabled>
                <option value="a4">A4</option>
              </select>
            </label>
            <label>
              Hướng trang
              <select
                value={pdfOrientation}
                onChange={(event) => setPdfOrientation(event.target.value as PdfOrientation)}
              >
                <option value="landscape">Ngang</option>
                <option value="portrait">Dọc</option>
              </select>
            </label>
          </>
        )}

        <div className="export-dialog-actions">
          <button type="button" className="btn-action" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn-action btn-export-primary"
            onClick={() =>
              onExport({
                format,
                fileName,
                pngBackground,
                pdfSize: "a4",
                pdfOrientation,
              })
            }
            disabled={busy}
          >
            {busy ? "Đang xuất..." : "Tải xuống"}
          </button>
        </div>
      </section>
    </div>
  );
};
