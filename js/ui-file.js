import * as DOM from './dom-elements.js';
import { state } from './state.js'; // Import the central state

export function showUploadedFile(file) {
    DOM.fileName.textContent = `파일명: ${file.name}`;
    DOM.fileSize.textContent = `파일 크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    DOM.fileInfo.style.display = 'block';
    DOM.uploadContainer.style.display = 'none';
    DOM.videoPreviewSection.style.display = 'flex';
    DOM.newVideoSection.style.display = 'block'; // 새 영상 불러오기 버튼 표시
}

export function updateVideoControls(enabled) {
    DOM.playBtn.disabled = !enabled;
    DOM.pauseBtn.disabled = !enabled;
    DOM.stopBtn.disabled = !enabled;
    DOM.rewindBtn.disabled = !enabled;
    DOM.fastForwardBtn.disabled = !enabled;
    DOM.skipToStartBtn.disabled = !enabled;
    DOM.skipToEndBtn.disabled = !enabled;
    DOM.playbackSpeedSelect.disabled = !enabled;
    
    // 프로그레스 바 상태 업데이트
    if (DOM.videoProgressBar) {
        DOM.videoProgressBar.disabled = !enabled;
    }
    
    // Safely check and update the transcription button
    const transcriptionBtn = document.getElementById('startTranscriptionBtn');
    if (transcriptionBtn) {
        transcriptionBtn.disabled = !enabled;
    }
}

// 시간을 mm:ss 형식으로 변환
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 비디오 시간 표시 업데이트
function updateVideoTimeDisplay() {
    if (!DOM.videoPreview || !DOM.currentTime || !DOM.totalTime) return;
    
    const currentTime = DOM.videoPreview.currentTime || 0;
    const duration = DOM.videoPreview.duration || 0;
    
    DOM.currentTime.textContent = formatTime(currentTime);
    DOM.totalTime.textContent = formatTime(duration);
}

// 프로그레스 바 업데이트
function updateVideoProgressBar() {
    if (!DOM.videoPreview || !DOM.videoProgressFill) return;
    
    const currentTime = DOM.videoPreview.currentTime || 0;
    const duration = DOM.videoPreview.duration || 0;
    
    if (duration > 0) {
        const progress = (currentTime / duration) * 100;
        DOM.videoProgressFill.style.width = `${progress}%`;
    } else {
        DOM.videoProgressFill.style.width = '0%';
    }
}

export function handleFile(file) {
    if (!file) return;
    state.uploadedFile = file; // 중앙 상태에 파일 저장
    showUploadedFile(file);
    
    // 이전 Blob URL이 있다면 메모리 누수 방지를 위해 해제
    if (state.videoPreview) {
        URL.revokeObjectURL(state.videoPreview);
    }

    // FileReader 대신 URL.createObjectURL 사용
    const videoURL = URL.createObjectURL(file);
    state.videoPreview = videoURL; // 생성된 URL을 상태에 저장
    
    DOM.videoPreview.src = videoURL;
    DOM.videoPreview.style.display = 'block';
    updateVideoControls(true);
    
    // 메타데이터 로드 후 시간 표시 업데이트
    DOM.videoPreview.addEventListener('loadedmetadata', () => {
        updateVideoTimeDisplay();
        updateVideoProgressBar();
    }, { once: true });
}

// 새 영상 불러오기 처리
function handleNewVideoLoad() {
    // 상태 초기화
    state.uploadedFile = null;
    if (DOM.videoPreview) {
        DOM.videoPreview.src = '';
        DOM.videoPreview.style.display = 'none';
    }
    
    // UI 초기화
    DOM.uploadContainer.style.display = 'flex';
    DOM.videoPreviewSection.style.display = 'none';
    DOM.newVideoSection.style.display = 'none';
    DOM.fileInfo.style.display = 'none';
    updateVideoControls(false);
    
    // 파일 입력 필드 초기화
    if (DOM.fileInput) {
        DOM.fileInput.value = '';
    }
    
    // 파일 선택 창 열기
    DOM.fileInput.click();
}


// 중복 등록 방지를 위한 플래그
let eventListenersSetup = false;

export function setupFileEventListeners() {
    // 이미 설정되었다면 중복 등록 방지
    if (eventListenersSetup) {
        console.log('📝 파일 이벤트 리스너가 이미 설정되어 있습니다 (중복 방지)');
        return;
    }
    
    console.log('📝 파일 이벤트 리스너 설정 시작');
    
    // 필수 DOM 요소 확인
    if (!DOM.fileInput || !DOM.uploadContainer) {
        console.error('❌ 필수 DOM 요소가 없습니다:', {
            fileInput: !!DOM.fileInput,
            uploadContainer: !!DOM.uploadContainer
        });
        return;
    }
    
    // 파일 입력 이벤트
    DOM.fileInput.addEventListener('change', (e) => {
        console.log('📁 파일 선택됨:', e.target.files[0]?.name);
        handleFile(e.target.files[0]);
    });
    
    // 업로드 컨테이너 클릭 이벤트
    DOM.uploadContainer.addEventListener('click', (e) => {
        console.log('📁 업로드 컨테이너 클릭됨');
        DOM.fileInput.click();
    });
    
    // 드래그 앤 드롭 이벤트들
    DOM.uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadContainer.classList.add('dragging');
    });
    
    DOM.uploadContainer.addEventListener('dragleave', () => {
        DOM.uploadContainer.classList.remove('dragging');
    });
    
    DOM.uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadContainer.classList.remove('dragging');
        console.log('📁 파일 드롭됨:', e.dataTransfer.files[0]?.name);
        handleFile(e.dataTransfer.files[0]);
    });

    // 비디오 컨트롤 이벤트들 - null 체크 추가
    if (DOM.playBtn) {
        DOM.playBtn.addEventListener('click', () => DOM.videoPreview?.play());
    }
    if (DOM.pauseBtn) {
        DOM.pauseBtn.addEventListener('click', () => DOM.videoPreview?.pause());
    }
    if (DOM.stopBtn) {
        DOM.stopBtn.addEventListener('click', () => {
            if (DOM.videoPreview) {
                DOM.videoPreview.pause();
                DOM.videoPreview.currentTime = 0;
            }
        });
    }
    if (DOM.rewindBtn) {
        DOM.rewindBtn.addEventListener('click', () => {
            if (DOM.videoPreview) DOM.videoPreview.currentTime -= 5;
        });
    }
    if (DOM.fastForwardBtn) {
        DOM.fastForwardBtn.addEventListener('click', () => {
            if (DOM.videoPreview) DOM.videoPreview.currentTime += 5;
        });
    }
    if (DOM.skipToStartBtn) {
        DOM.skipToStartBtn.addEventListener('click', () => {
            if (DOM.videoPreview) DOM.videoPreview.currentTime = 0;
        });
    }
    if (DOM.skipToEndBtn) {
        DOM.skipToEndBtn.addEventListener('click', () => {
            if (DOM.videoPreview) DOM.videoPreview.currentTime = DOM.videoPreview.duration || 0;
        });
    }
    if (DOM.playbackSpeedSelect) {
    DOM.playbackSpeedSelect.addEventListener('change', (e) => {
            if (DOM.videoPreview) DOM.videoPreview.playbackRate = parseFloat(e.target.value);
    });
    }

    // 프로그레스 바 클릭 이벤트
    if (DOM.videoProgressBar) {
        DOM.videoProgressBar.addEventListener('click', (e) => {
            if (DOM.videoPreview && DOM.videoPreview.duration) {
                const rect = DOM.videoProgressBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickRatio = clickX / rect.width;
                DOM.videoPreview.currentTime = clickRatio * DOM.videoPreview.duration;
            }
        });
    }

    // 비디오 시간 업데이트 이벤트
    if (DOM.videoPreview) {
        DOM.videoPreview.addEventListener('loadedmetadata', () => {
            updateVideoTimeDisplay();
        });
        
        DOM.videoPreview.addEventListener('timeupdate', () => {
            updateVideoTimeDisplay();
            updateVideoProgressBar();
        });
    }

    // 새 영상 로드 버튼 - null 체크 추가
    if (DOM.loadNewVideoButton) {
        DOM.loadNewVideoButton.addEventListener('click', handleNewVideoLoad);
    } else {
        console.warn('⚠️ loadNewVideoButton 요소를 찾을 수 없습니다');
    }

    if (DOM.uploadContainer) {
        DOM.uploadContainer.addEventListener('mouseenter', window.loadFileModules);
    }
    
    // 설정 완료 플래그
    eventListenersSetup = true;
    console.log('✅ 파일 이벤트 리스너 설정 완료');
} 