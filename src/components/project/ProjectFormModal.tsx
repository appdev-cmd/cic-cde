import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import type { ProjectItem } from './ProjectList';

interface ProjectFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  project?: ProjectItem;
  onClose: () => void;
  onSubmit: (projectData: any) => Promise<void>;
  existingProjectIds: string[];
}

export function ProjectFormModal({
  isOpen,
  mode,
  project,
  onClose,
  onSubmit,
  existingProjectIds
}: ProjectFormModalProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectItem['status']>('Chuẩn bị');
  const [progress, setProgress] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [province, setProvince] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [tilesUrl, setTilesUrl] = useState('');
  const [description, setDescription] = useState('');
  const [projectGroup, setProjectGroup] = useState('');
  const [buildingGrade, setBuildingGrade] = useState('');
  const [coverImage, setCoverImage] = useState('');

  const [isIdManuallyEdited, setIsIdManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset/Initialize form when modal opens or project changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && project) {
        setId(project.id);
        setName(project.name);
        setClient(project.client || '');
        setLocation(project.location || '');
        setStatus(project.status || 'Chuẩn bị');
        setProgress(project.progress || 0);
        setStartDate(project.startDate || '');
        setProvince(project.province || '');
        setLat(project.lat !== undefined ? String(project.lat) : '');
        setLng(project.lng !== undefined ? String(project.lng) : '');
        setTilesUrl(project.tilesUrl || '');
        setDescription(project.description || '');
        setProjectGroup(project.projectGroup || '');
        setBuildingGrade(project.buildingGrade || '');
        setCoverImage(project.coverImage || '');
        setIsIdManuallyEdited(true);
      } else {
        setId('');
        setName('');
        setClient('');
        setLocation('');
        setStatus('Chuẩn bị');
        setProgress(0);
        setStartDate('');
        setProvince('');
        setLat('');
        setLng('');
        setTilesUrl('');
        setDescription('');
        setProjectGroup('');
        setBuildingGrade('');
        setCoverImage('');
        setIsIdManuallyEdited(false);
      }
      setError(null);
    }
  }, [isOpen, mode, project]);

  // Generate slug/ID from name
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD') // Decompose combined graphemes to decompose Vietnamese accents
      .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese accent symbols
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '-'); // Replace spaces with hyphens
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (mode === 'create' && !isIdManuallyEdited) {
      setId(slugify(val));
    }
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setId(val);
    setIsIdManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!id.trim()) {
      setError('Mã dự án là bắt buộc.');
      return;
    }
    if (!name.trim()) {
      setError('Tên dự án là bắt buộc.');
      return;
    }

    if (mode === 'create' && existingProjectIds.includes(id.trim())) {
      setError('Mã dự án này đã tồn tại. Vui lòng nhập mã khác.');
      return;
    }

    const parsedLat = lat.trim() !== '' ? parseFloat(lat) : undefined;
    const parsedLng = lng.trim() !== '' ? parseFloat(lng) : undefined;

    if (lat.trim() !== '' && isNaN(Number(lat))) {
      setError('Vĩ độ phải là một số hợp lệ.');
      return;
    }
    if (lng.trim() !== '' && isNaN(Number(lng))) {
      setError('Kinh độ phải là một số hợp lệ.');
      return;
    }

    if (progress < 0 || progress > 100) {
      setError('Tiến độ phải nằm trong khoảng từ 0 đến 100.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        id: id.trim(),
        name: name.trim(),
        client: client.trim(),
        location: location.trim(),
        status,
        progress: Number(progress),
        startDate: startDate.trim(),
        province: province.trim(),
        lat: parsedLat,
        lng: parsedLng,
        tilesUrl: tilesUrl.trim(),
        description: description.trim(),
        projectGroup: projectGroup.trim(),
        buildingGrade: buildingGrade.trim(),
        coverImage: coverImage.trim()
      };
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi gửi form dự án:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lưu thông tin dự án.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-inverse-on-surface/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-[640px] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low/30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="text-primary" size={20} />
            <h3 className="font-bold text-[16px] text-on-surface">
              {mode === 'create' ? 'Tạo Dự án CDE Mới' : `Chỉnh sửa: ${project?.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3.5 bg-error/10 border border-error/20 text-error rounded-xl text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tên dự án */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Tên dự án *</label>
              <input
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                placeholder="Ví dụ: FPT Arch Tower"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Mã dự án */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Mã dự án (ID) *</label>
              <input
                type="text"
                required
                disabled={mode === 'edit'}
                value={id}
                onChange={handleIdChange}
                placeholder="Ví dụ: fpt-arch"
                className={`w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75 ${
                  mode === 'edit' ? 'cursor-not-allowed opacity-60 text-outline' : 'text-on-surface'
                }`}
              />
              {mode === 'create' && (
                <span className="text-[10px] text-outline mt-1 block">
                  Định dạng: chữ thường không dấu, phân tách bằng dấu gạch ngang (-). Dùng cho mã tài liệu ISO 19650.
                </span>
              )}
            </div>

            {/* Chủ đầu tư */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Chủ đầu tư</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ví dụ: FPT Group"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Nhóm dự án */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Nhóm dự án</label>
              <select
                value={projectGroup}
                onChange={(e) => setProjectGroup(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              >
                <option value="">Chọn nhóm dự án</option>
                <option value="Nhóm A">Nhóm A</option>
                <option value="Nhóm B">Nhóm B</option>
                <option value="Nhóm C">Nhóm C</option>
                <option value="Dự án quan trọng quốc gia">Dự án quan trọng quốc gia</option>
              </select>
            </div>

            {/* Cấp công trình */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Cấp công trình</label>
              <select
                value={buildingGrade}
                onChange={(e) => setBuildingGrade(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              >
                <option value="">Chọn cấp công trình</option>
                <option value="Cấp đặc biệt">Cấp đặc biệt</option>
                <option value="Cấp I">Cấp I</option>
                <option value="Cấp II">Cấp II</option>
                <option value="Cấp III">Cấp III</option>
                <option value="Cấp IV">Cấp IV</option>
              </select>
            </div>

            {/* Địa điểm */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Địa điểm thực tế</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ví dụ: Khu công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Tỉnh/Thành phố */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Tỉnh / Thành phố</label>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Ví dụ: Hà Nội"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Trạng thái */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectItem['status'])}
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              >
                <option value="Chuẩn bị">Chuẩn bị</option>
                <option value="Thi công ngầm">Thi công ngầm</option>
                <option value="Thi công">Thi công</option>
                <option value="Đang hoàn thiện">Đang hoàn thiện</option>
              </select>
            </div>

            {/* Tiến độ */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Tiến độ tổng thể (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))}
                placeholder="0 - 100"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Ngày bắt đầu */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Ngày bắt đầu</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Ví dụ: 01/2025"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Tọa độ - Vĩ độ */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Vĩ độ (Latitude)</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Ví dụ: 21.0135"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Tọa độ - Kinh độ */}
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Kinh độ (Longitude)</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Ví dụ: 105.5268"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* 3D Tiles URL */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Đường dẫn 3D Tiles URL (BIM/GIS)</label>
              <input
                type="text"
                value={tilesUrl}
                onChange={(e) => setTilesUrl(e.target.value)}
                placeholder="https://example.com/3d-tiles/tileset.json"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Ảnh đại diện URL */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Đường dẫn ảnh đại diện (URL)</label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/images/project-cover.jpg"
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75"
              />
            </div>

            {/* Mô tả */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider">Mô tả dự án</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả thông tin tổng quát về quy mô, chức năng của công trình..."
                className="w-full mt-1 px-3 py-2 bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/75 resize-none"
              />
            </div>
          </div>

          {/* Form Footer */}
          <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface-container-lowest sticky bottom-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-outline text-on-surface hover:bg-surface-container rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>}
              {mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
