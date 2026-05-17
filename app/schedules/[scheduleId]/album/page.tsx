'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { scheduleApi } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/utils/error';
import type { TripPhoto, TripPhotoAlbum, TripPhotoAlbumSlot } from '@/lib/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function getPhotoSrc(scheduleId: number, photo: TripPhoto) {
  return photo.imageUrl || photo.contentUrl || scheduleApi.getPhotoContentUrl(scheduleId, photo.photoId);
}

type UploadSheetState = {
  slot: TripPhotoAlbumSlot;
  caption: string;
  file: File | null;
  previewUrl: string | null;
};

export default function ScheduleAlbumPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = Number(params.scheduleId);

  const [album, setAlbum] = useState<TripPhotoAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<UploadSheetState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const totalPhotoCount = album?.totalPhotoCount ?? album?.slots.reduce((sum, slot) => sum + slot.photos.length, 0) ?? 0;
  const localPickCount = album?.slots.filter((slot) => slot.place.isDepopulationArea).length ?? 0;

  const representativePhotos = useMemo(() => {
    return album?.slots.flatMap((slot) => slot.photos.slice(0, 2)).slice(0, 6) ?? [];
  }, [album]);

  const loadAlbum = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!Number.isFinite(scheduleId)) {
      setError('사진첩 주소가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await scheduleApi.getAlbum(scheduleId);
      const data = res.data?.data as TripPhotoAlbum | undefined;
      if (!data) throw new Error('empty_album');
      setAlbum(data);
    } catch (err) {
      setError(getApiErrorMessage(err, '사진첩을 불러오지 못했습니다. 일정 멤버만 접근할 수 있어요.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    void loadAlbum();
  }, [loadAlbum]);

  useEffect(() => {
    if (!sheet) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      if (sheet.previewUrl) URL.revokeObjectURL(sheet.previewUrl);
    };
  }, [sheet]);

  function openUploadSheet(slot: TripPhotoAlbumSlot) {
    setFileError(null);
    setSheet({ slot, caption: '', file: null, previewUrl: null });
  }

  function closeUploadSheet() {
    if (sheet?.previewUrl) URL.revokeObjectURL(sheet.previewUrl);
    setSheet(null);
    setFileError(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!sheet) return;

    if (sheet.previewUrl) URL.revokeObjectURL(sheet.previewUrl);

    if (!file) {
      setSheet({ ...sheet, file: null, previewUrl: null });
      setFileError(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setSheet({ ...sheet, file: null, previewUrl: null });
      setFileError('jpeg, png, webp 사진만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSheet({ ...sheet, file: null, previewUrl: null });
      setFileError('사진은 10MB 이하만 업로드할 수 있습니다.');
      return;
    }

    setFileError(null);
    setSheet({ ...sheet, file, previewUrl: URL.createObjectURL(file) });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheet?.file) {
      setFileError('업로드할 사진을 선택해 주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('file', sheet.file);
    const caption = sheet.caption.trim();
    if (caption) formData.append('caption', caption);

    setUploading(true);
    setError(null);
    try {
      await scheduleApi.uploadPhoto(scheduleId, sheet.slot.scheduleSlotId, formData);
      closeUploadSheet();
      await loadAlbum('refresh');
    } catch (err) {
      setFileError(getApiErrorMessage(err, '사진 업로드에 실패했습니다. 멤버 권한과 파일 형식을 확인해 주세요.'));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="app-shell app-page items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 h-14 w-14 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-500" />
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">사진첩을 여는 중…</h1>
          <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">확정 일정의 장소별 사진을 불러오고 있어요.</p>
        </div>
      </div>
    );
  }

  if (error && !album) {
    return (
      <div className="app-shell app-page">
        <div className="app-content flex min-h-[100dvh] items-center justify-center py-16">
          <div className="card-bezel w-full max-w-lg">
            <div className="card-bezel-inner p-8 text-center md:p-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-100 bg-red-50">
                <iconify-icon icon="solar:lock-keyhole-bold-duotone" width="30" className="text-red-500"></iconify-icon>
              </div>
              <span className="app-kicker mb-4 border-red-100 bg-red-50 text-red-600">Members Only</span>
              <h1 className="mb-3 text-3xl font-black tracking-tight text-zinc-900">사진첩을 열 수 없어요</h1>
              <p className="mb-8 text-sm font-normal leading-relaxed text-zinc-700">{error}</p>
              <button type="button" onClick={() => router.back()} className="btn-primary inline-flex w-auto px-6">
                이전 화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell app-page">
      <div className="app-topbar">
        <button onClick={() => router.back()} className="app-icon-button" aria-label="이전으로">
          <iconify-icon icon="solar:arrow-left-linear" width="22" className="text-zinc-700"></iconify-icon>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="app-topbar-title">공유 사진첩</div>
          <div className="app-topbar-meta">멤버 전용 · 공개 공유 제외</div>
        </div>
        <button onClick={() => loadAlbum('refresh')} className="app-link-button px-3 py-2 text-sm" type="button" disabled={refreshing}>
          <iconify-icon icon="solar:refresh-bold-duotone" width="18"></iconify-icon>
          {refreshing ? '갱신 중' : '갱신'}
        </button>
      </div>

      <main className="app-content pt-10 pb-24">
        <section className="card-bezel mb-6">
          <div className="card-bezel-inner overflow-hidden p-7 md:p-9">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="app-kicker border-blue-100 bg-blue-50 text-blue-600">Shared Album</span>
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                확정 일정 기반
              </span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700">
                총 {totalPhotoCount}장
              </span>
            </div>
            <h1 className="mb-3 text-[30px] font-black tracking-tight text-zinc-900 break-keep-all md:text-[38px]">
              {album?.destination ? `${album.destination} 사진첩` : '우리 여행 사진첩'}
            </h1>
            <p className="max-w-2xl text-sm font-normal leading-relaxed text-zinc-700 md:text-base">
              확정된 일정의 장소 카드 아래에 사진을 모읍니다. 지금은 방 멤버만 조회·업로드할 수 있고, 공개 공유 링크는 제공하지 않습니다.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-sm font-normal text-zinc-700">장소 슬롯</p>
                <p className="mt-1 text-2xl font-black text-zinc-900">{album?.slots.length ?? 0}</p>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-sm font-normal text-zinc-700">사진 수</p>
                <p className="mt-1 text-2xl font-black text-blue-600">{totalPhotoCount}</p>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-sm font-normal text-zinc-700">로컬 픽</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{localPickCount}</p>
              </div>
            </div>

            {representativePhotos.length > 0 ? (
              <div className="mt-6 grid grid-cols-3 gap-2 overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-100 p-2 sm:grid-cols-6">
                {representativePhotos.map((photo) => (
                  <div key={photo.photoId} className="aspect-square overflow-hidden rounded-[18px] bg-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getPhotoSrc(scheduleId, photo)} alt={photo.caption || '여행 사진'} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="app-alert app-alert-danger mb-5">{error}</div> : null}

        {album?.isConfirmed === false ? (
          <section className="card-app p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-100 bg-amber-50">
              <iconify-icon icon="solar:calendar-mark-bold-duotone" width="28" className="text-amber-500"></iconify-icon>
            </div>
            <h2 className="text-xl font-black tracking-tight text-zinc-900">확정 일정에서만 사진첩을 사용할 수 있어요</h2>
            <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">일정 옵션을 확정한 뒤 장소별 추억을 업로드할 수 있습니다.</p>
          </section>
        ) : album?.slots.length === 0 ? (
          <section className="card-app p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50">
              <iconify-icon icon="solar:gallery-minimalistic-bold-duotone" width="28" className="text-zinc-500"></iconify-icon>
            </div>
            <h2 className="text-xl font-black tracking-tight text-zinc-900">아직 연결된 장소가 없어요</h2>
            <p className="mt-2 text-sm font-normal leading-relaxed text-zinc-700">확정 일정에 장소 슬롯이 생기면 사진 업로드 카드가 표시됩니다.</p>
          </section>
        ) : (
          <section className="space-y-5">
            {album?.slots.map((slot) => (
              <article key={slot.scheduleSlotId} className="card-app overflow-hidden p-5 md:p-6">
                <div className="mb-5 flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[12px] font-semibold text-zinc-700">
                        {slot.orderIndex}번째 코스
                      </span>
                      {slot.place.isDepopulationArea ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">로컬 픽</span>
                      ) : null}
                      {slot.startTime && slot.endTime ? (
                        <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-zinc-900">{slot.place.name}</h2>
                    <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">{slot.place.address}</p>
                  </div>
                  <button type="button" onClick={() => openUploadSheet(slot)} className="btn-primary w-full shrink-0 px-5 py-3 text-sm sm:w-auto">
                    <iconify-icon icon="solar:camera-add-bold-duotone" width="18"></iconify-icon>
                    사진 올리기
                  </button>
                </div>

                {slot.photos.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openUploadSheet(slot)}
                    className="w-full rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white">
                      <iconify-icon icon="solar:gallery-add-bold-duotone" width="24" className="text-blue-500"></iconify-icon>
                    </div>
                    <p className="text-base font-bold text-zinc-900">이 장소의 첫 사진을 남겨보세요</p>
                    <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">jpeg, png, webp · 최대 10MB</p>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {slot.photos.map((photo) => (
                      <figure key={photo.photoId} className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="aspect-square bg-zinc-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getPhotoSrc(scheduleId, photo)} alt={photo.caption || `${slot.place.name} 사진`} className="h-full w-full object-cover" loading="lazy" />
                        </div>
                        <figcaption className="px-3 py-3">
                          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-normal leading-relaxed text-zinc-700">
                            {photo.caption || '캡션 없는 사진'}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-zinc-500">
                            <span className="truncate">{photo.uploaderNickname}</span>
                            <span>{formatBytes(photo.sizeBytes)}</span>
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </main>

      {sheet ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={closeUploadSheet} />
          <form onSubmit={handleUpload} className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl animate-fadeInUp">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-5">
              <div>
                <h3 className="text-xl font-black tracking-tight text-zinc-900">{sheet.slot.place.name} 사진 업로드</h3>
                <p className="mt-1 text-sm font-normal leading-relaxed text-zinc-700">멤버만 볼 수 있는 사진첩에 저장됩니다.</p>
              </div>
              <button type="button" onClick={closeUploadSheet} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900" aria-label="업로드 닫기">
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-900">사진 파일</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-bold file:text-blue-700" />
              </label>

              {sheet.previewUrl ? (
                <div className="mt-4 overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sheet.previewUrl} alt="업로드 미리보기" className="max-h-[320px] w-full object-contain" />
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center">
                  <p className="text-sm font-normal leading-relaxed text-zinc-700">jpeg, png, webp 파일을 선택해 주세요. 최대 10MB까지 업로드할 수 있습니다.</p>
                </div>
              )}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold text-zinc-900">캡션</span>
                <textarea
                  value={sheet.caption}
                  onChange={(event) => setSheet({ ...sheet, caption: event.target.value })}
                  maxLength={120}
                  rows={3}
                  placeholder="이 순간을 짧게 적어주세요"
                  className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
                <span className="mt-1 block text-right text-[12px] font-medium text-zinc-500">{sheet.caption.length}/120</span>
              </label>

              {fileError ? <div className="app-alert app-alert-danger mt-4">{fileError}</div> : null}
            </div>

            <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
              <button type="submit" disabled={uploading || !sheet.file} className="btn-primary py-4 text-base">
                {uploading ? '업로드 중…' : '사진 업로드하기'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
