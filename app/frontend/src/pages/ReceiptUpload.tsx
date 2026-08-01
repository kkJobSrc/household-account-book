import { useEffect, useState, useRef, useCallback } from 'react';
import {
  uploadReceiptImages,
  getReceiptImages,
  deleteReceiptImage,
  getReceiptImageFileUrl,
  getMembers,
} from '../api';
import type { Member, ReceiptImage, ReceiptImageUploadResponse, OcrStatus } from '../types';

// Warn (not a hard limit) when the user selects more than this many files at once
const WARN_FILE_COUNT = 20;
// Resize target: long side in pixels
const MAX_DIMENSION = 1024;
// JPEG re-encode quality
const JPEG_QUALITY = 0.8;

const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  pending: '未処理',
  processing: '処理中',
  completed: '完了',
  failed: '失敗',
};

interface SelectedFile {
  file: File;
  previewUrl: string;
}

// Detect HEIC/HEIF files, which cannot be drawn onto a <canvas> in most browsers.
// These are uploaded as-is and normalized on the backend instead.
function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

// Resize and re-encode an image file via <canvas> to reduce upload size.
// Long side is capped at MAX_DIMENSION px, output as JPEG at JPEG_QUALITY.
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], compressedName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReceiptUpload() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ReceiptImageUploadResponse | null>(null);
  const [history, setHistory] = useState<ReceiptImage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getReceiptImages();
      setHistory(data);
    } catch {
      // Keep the previous list on failure; error is already logged by the axios interceptor
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    getMembers().then(setMembers);
    loadHistory();
  }, [loadHistory]);

  // Revoke object URLs when the selection changes or the component unmounts,
  // to avoid leaking memory.
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Clean up previously selected previews before replacing the selection
    selectedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));

    const next = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setSelectedFiles(next);
    setUploadResult(null);
    // Allow selecting the same file(s) again later
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      // Compress each file individually; HEIC/HEIF files are uploaded unmodified
      // because <canvas> cannot decode them in most browsers.
      const processedFiles = await Promise.all(
        selectedFiles.map(async ({ file }) => {
          if (isHeicFile(file)) return file;
          try {
            return await compressImage(file);
          } catch {
            // Fall back to the original file if compression fails for any reason
            return file;
          }
        })
      );

      const result = await uploadReceiptImages(
        processedFiles,
        selectedMemberId === '' ? undefined : selectedMemberId
      );
      setUploadResult(result);
      selectedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      loadHistory();
    } catch {
      alert('アップロードに失敗しました。通信状況を確認してください。');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('このレシート画像を削除しますか？')) return;
    try {
      await deleteReceiptImage(id);
      loadHistory();
    } catch {
      alert('削除に失敗しました。通信状況を確認してください。');
    }
  };

  const totalSelectedSize = selectedFiles.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">レシート画像アップロード</h1>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">メンバー（任意）</label>
          <select
            className="form-control"
            value={selectedMemberId}
            onChange={e => setSelectedMemberId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">未選択</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">レシート画像</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="form-control"
          />
        </div>

        {selectedFiles.length > WARN_FILE_COUNT && (
          <div className="receipt-warning">
            ⚠️ {selectedFiles.length}枚選択されています。一度に大量の画像をアップロードすると時間がかかる場合があります（目安: {WARN_FILE_COUNT}枚以下）。
          </div>
        )}

        {selectedFiles.length > 0 && (
          <>
            <div className="receipt-preview-grid">
              {selectedFiles.map((f, i) => (
                <div key={i} className="receipt-preview-item">
                  <img src={f.previewUrl} alt={f.file.name} className="receipt-preview-img" />
                  <div className="receipt-preview-meta">
                    <span className="receipt-preview-name">{f.file.name}</span>
                    <span className="receipt-preview-size">{formatFileSize(f.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeSelectedFile(i)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <p className="receipt-total-size">選択中: {selectedFiles.length}枚 / 合計 {formatFileSize(totalSelectedSize)}</p>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? 'アップロード中...' : `アップロード${selectedFiles.length > 0 ? `（${selectedFiles.length}枚）` : ''}`}
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="cat-section-title">アップロード結果</h3>
          {uploadResult.uploaded.length > 0 && (
            <ul className="receipt-result-list">
              {uploadResult.uploaded.map(item => (
                <li key={item.id} className="receipt-result-item">
                  <span>ID: {item.id}</span>
                  {item.duplicate && <span className="badge receipt-badge-duplicate">重複</span>}
                  <span className="badge receipt-badge-status">{OCR_STATUS_LABELS[item.ocr_status]}</span>
                </li>
              ))}
            </ul>
          )}
          {uploadResult.rejected.length > 0 && (
            <div className="receipt-rejected">
              {uploadResult.rejected.map((r, i) => (
                <div key={i} className="receipt-rejected-item">
                  ❌ {r.filename}: {r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <h3 className="cat-section-title" style={{ padding: '20px 20px 0' }}>アップロード履歴</h3>
        {historyLoading ? (
          <div className="loading">読み込み中...</div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <p>アップロードされたレシート画像がありません</p>
          </div>
        ) : (
          <div className="receipt-history-grid">
            {history.map(item => (
              <div key={item.id} className="receipt-history-item">
                <img
                  src={getReceiptImageFileUrl(item.id)}
                  alt={`receipt-${item.id}`}
                  className="receipt-history-img"
                />
                <div className="receipt-history-meta">
                  <span className="badge receipt-badge-status">{OCR_STATUS_LABELS[item.ocr_status]}</span>
                  <span className="receipt-history-size">{formatFileSize(item.file_size)}</span>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(item.id)}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .receipt-warning {
          background: var(--color-expense-light);
          color: var(--color-expense);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .receipt-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }
        .receipt-preview-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 8px;
        }
        .receipt-preview-img {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 4px;
        }
        .receipt-preview-meta {
          display: flex;
          flex-direction: column;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .receipt-preview-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .receipt-total-size {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0 0 16px;
        }
        .receipt-result-list {
          list-style: none;
          padding: 0;
          margin: 0 0 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .receipt-result-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .receipt-badge-duplicate {
          background: #fef3c7;
          color: #b45309;
        }
        .receipt-badge-status {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }
        .receipt-rejected {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .receipt-rejected-item {
          color: var(--color-expense);
          font-size: 13px;
        }
        .receipt-history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          padding: 16px 20px 20px;
        }
        .receipt-history-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 8px;
        }
        .receipt-history-img {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 4px;
        }
        .receipt-history-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  );
}
