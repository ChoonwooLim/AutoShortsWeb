// js/face-analyzer-new.js
// "세계 최고"를 지향하는 전문가용 얼굴 분석 엔진

import { state, workLogManager } from './state.js';

const MODEL_URL = './models';
let modelsLoaded = false;
let isAnalyzing = false;

// --- UI Elements ---
let videoEl;
let progressContainer;
let progressText;
let progressBarFill;
let resultsContainer;
let analyzeBtn;
let mergeBtn; // 병합 버튼 UI 요소 추가
let mergeControls; // 병합 버튼 컨테이너

let currentActors = []; // 현재 분석된 인물 목록을 저장할 변수

function updateState(newState) {
    Object.assign(state.v2FaceAnalysis, newState);
    console.log('Face analysis state updated:', state.v2FaceAnalysis);
}

/**
 * 전문가 분석에 필요한 모든 AI 모델(나이/성별, 표정 포함)을 로드합니다.
 */
async function loadModels() {
    if (modelsLoaded) return true;
    
    const progressPayload = {
        progressText: '전문가용 분석 모델 로딩 중...',
        progress: 0
    };
    updateState(progressPayload);
    progressText.textContent = progressPayload.progressText;
    progressContainer.style.display = 'block';

    try {
        console.log('⏳ V2(전문가) 모델 로딩 시작...');
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        console.log('✅ V2(전문가) 모델 로딩 완료.');
        return true;
    } catch (error) {
        console.error('❌ V2(전문가) 모델 로딩 실패:', error);
        updateState({ status: 'error', error: '모델 로딩에 실패했습니다.' });
        alert('얼굴 분석 모델 로딩에 실패했습니다. 인터넷 연결을 확인해주세요.');
        return false;
    }
}

/**
 * 분석 결과를 전문가 수준의 UI로 화면에 표시합니다.
 * @param {Array} actors - 분석된 배우 정보 배열
 * @param {number} duration - 비디오 총 길이 (타임라인 생성용)
 */
function displayResults(actors, duration) {
    resultsContainer.innerHTML = '';
    currentActors = actors; // 분석 결과를 전역 변수에 저장

    // 중앙 상태 업데이트
    updateState({ actors: actors, status: 'completed', progress: 100 });
    
    if (actors.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #888;">영상에서 인물을 찾지 못했습니다.</p>';
        mergeControls.style.display = 'none'; // 결과 없으면 병합 버튼 숨김
        return;
    }

    mergeControls.style.display = 'block'; // 결과 있으면 병합 버튼 표시
    mergeBtn.disabled = true;

    actors.sort((a, b) => b.totalAppearances - a.totalAppearances);

    actors.forEach((actor, index) => {
        const emotions = Object.entries(actor.emotionSummary)
            .sort(([, a], [, b]) => b - a)
            .map(([emotion, count]) => `${emotion}(${count})`)
            .join(', ');

        const timelineMarkers = actor.appearances.map(time =>
            `<div class="timeline-marker" style="left: ${(time / duration) * 100}%;" data-time="${time}"></div>`
        ).join('');

        const actorCard = document.createElement('div');
        actorCard.className = 'face-card professional';
        actorCard.dataset.actorId = actor.id; // 각 카드에 고유 ID 부여
        actorCard.innerHTML = `
            <div class="face-card-selection">
                <input type="checkbox" class="actor-checkbox" data-actor-id="${actor.id}">
            </div>
            <img src="${actor.image}" alt="${actor.label}" class="face-card-img">
            <div class="face-card-content">
                <div class="face-card-header">
                    <div class="face-card-title">
                        <h4>${actor.label}</h4>
                        <p>추정: ${actor.gender}, 약 ${Math.round(actor.avgAge)}세</p>
                    </div>
                </div>
                <div class="face-card-body">
                    <p><strong>총 등장 횟수:</strong> ${actor.totalAppearances}회</p>
                    <p><strong>주요 감정:</strong> ${emotions || '분석 정보 없음'}</p>
                    <p><strong>등장 타임라인:</strong></p>
                    <div class="timeline-container">${timelineMarkers}</div>
                </div>
            </div>
        `;
        resultsContainer.appendChild(actorCard);
    });

    // 타임라인 마커에 클릭 이벤트 추가
    resultsContainer.querySelectorAll('.timeline-marker').forEach(marker => {
        marker.addEventListener('click', (e) => {
            const time = parseFloat(e.target.dataset.time);
            if (videoEl) {
                videoEl.currentTime = time;
                videoEl.play(); // 클릭 시 바로 재생
                setTimeout(() => videoEl.pause(), 500); // 0.5초 후 정지
            }
        });
    });

    // 체크박스 변경 감지 이벤트
    resultsContainer.querySelectorAll('.actor-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const selectedCount = resultsContainer.querySelectorAll('.actor-checkbox:checked').length;
            mergeBtn.disabled = selectedCount < 2;

            // 선택된 카드에 시각적 효과 적용
            const card = checkbox.closest('.face-card');
            if (checkbox.checked) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    });
}

/**
 * 선택된 인물들을 병합하는 함수
 */
function handleMerge() {
    const selectedCheckboxes = resultsContainer.querySelectorAll('.actor-checkbox:checked');
    if (selectedCheckboxes.length < 2) {
        alert('병합하려면 두 명 이상의 인물을 선택해야 합니다.');
        return;
    }

    const selectedActorIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.actorId);
    
    // 선택된 인물과 선택되지 않은 인물 분리
    const actorsToMerge = currentActors.filter(actor => selectedActorIds.includes(actor.id));
    const remainingActors = currentActors.filter(actor => !selectedActorIds.includes(actor.id));

    // 데이터 병합
    const mergedDetections = actorsToMerge.flatMap(actor => actor.detections);
    
    // Best Shot 재선정 (가장 큰 얼굴)
    const bestDetection = mergedDetections.reduce((best, current) => 
        current.detection.box.area > best.detection.box.area ? current : best
    );

    // 병합된 인물의 새 대표 이미지 생성
    const faceCanvas = document.createElement('canvas');
    // ... (이미지 생성 로직은 startAnalysis 함수에서 가져와 재사용)
    videoEl.currentTime = bestDetection.timestamp;
    videoEl.onseeked = () => { // onseeked 콜백을 사용하여 비동기 처리
        const { x, y, width, height } = bestDetection.detection.box;
        const widthScale = 1.5, heightScale = 2.0;
        const newWidth = width * widthScale, newHeight = height * heightScale;
        let newX = x - (newWidth - width) / 2, newY = y - (newHeight - height) / 3;
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        const finalWidth = Math.min(newWidth, videoEl.videoWidth - newX);
        const finalHeight = Math.min(newHeight, videoEl.videoHeight - newY);
        faceCanvas.width = finalWidth;
        faceCanvas.height = finalHeight;
        faceCanvas.getContext('2d').drawImage(videoEl, newX, newY, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);

        // 병합된 인물의 정보 재계산
        const gender = mergedDetections.map(d => d.gender).sort((a,b) => mergedDetections.filter(v => v.gender===a).length - mergedDetections.filter(v => v.gender===b).length).pop();
        const avgAge = mergedDetections.reduce((sum, d) => sum + d.age, 0) / mergedDetections.length;
        const emotionSummary = {};
        mergedDetections.forEach(d => {
            const topEmotion = Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b);
            emotionSummary[topEmotion] = (emotionSummary[topEmotion] || 0) + 1;
        });

        const mergedActor = {
            id: `actor-${Date.now()}-${Math.random()}`,
            label: actorsToMerge[0].label, // 첫 번째 선택된 인물의 이름 사용 (추후 편집 기능 추가 가능)
            image: faceCanvas.toDataURL(),
            gender: gender === 'male' ? '남성' : '여성',
            avgAge: avgAge,
            emotionSummary: emotionSummary,
            totalAppearances: mergedDetections.length,
            appearances: mergedDetections.map(d => d.timestamp).sort((a,b) => a - b),
            detections: mergedDetections
        };

        // 새로운 인물 목록으로 UI 업데이트
        const newActorList = [mergedActor, ...remainingActors];
        displayResults(newActorList, videoEl.duration);
        
        // 작업 로그 추가
        workLogManager.addWorkLog('face-analysis', `인물 병합: ${actorsToMerge.map(a => a.label).join(', ')} -> ${mergedActor.label}`);
    };
}


/**
 * '전문가 모드' 얼굴 분석 프로세스
 */
export async function startAnalysis() {
    if (isAnalyzing) {
        alert('분석이 이미 진행 중입니다.');
        return;
    }
    isAnalyzing = true;
    
    updateState({ status: 'analyzing', progress: 0, progressText: '분석 준비 중...', actors: [], error: null });


    // 1. UI 초기화
    videoEl = document.getElementById('videoPreview');
    progressContainer = document.getElementById('analysisProgressV2');
    progressText = document.getElementById('progressTextV2');
    progressBarFill = document.getElementById('progressBarFillV2');
    resultsContainer = document.getElementById('faceResultsV2');
    analyzeBtn = document.getElementById('analyzeFacesBtnV2');
    mergeBtn = document.getElementById('mergeActorsBtn');
    mergeControls = document.querySelector('.merge-controls');

    // 병합 버튼 이벤트 리스너 추가
    mergeBtn.addEventListener('click', handleMerge);

    resultsContainer.innerHTML = '<p style="text-align: center; color: #888;">전문가 분석을 시작합니다. 정확도를 위해 시간이 오래 소요될 수 있습니다...</p>';
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';
    progressBarFill.style.width = '0%';
    progressContainer.style.display = 'block';

    if (!state.uploadedFile || !videoEl.src) {
        alert('먼저 동영상 파일을 업로드해주세요.');
        updateState({ status: 'error', error: '동영상 파일이 없습니다.'});
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '얼굴 분석 (V2)';
        mergeControls.style.display = 'none';
        return;
    }

    // 2. 모델 로드
    if (!await loadModels()) {
        updateState({ status: 'idle' }); // 에러는 loadModels에서 처리
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '얼굴 분석 (V2)';
        progressContainer.style.display = 'none';
        mergeControls.style.display = 'none';
        return;
    }

    // 3. 비디오 준비
    await new Promise(resolve => {
        if (videoEl.readyState >= 2) return resolve();
        videoEl.onloadeddata = () => resolve();
    });
    videoEl.pause();
    videoEl.currentTime = 0;

    // 4. 초고밀도 프레임 분석 (1초당 2프레임)
    const SAMPLING_RATE_FPS = 2;
    const interval = 1 / SAMPLING_RATE_FPS;
    const allDetections = [];

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;

    for (let time = 0; time < videoEl.duration; time += interval) {
        videoEl.currentTime = time;
        await new Promise(resolve => { videoEl.onseeked = () => resolve(); });

        tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

        const detections = await faceapi
            .detectAllFaces(tempCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()
            .withFaceDescriptors();

        detections.forEach(d => {
            d.timestamp = time;
            allDetections.push(d);
        });

        const progress = (time / videoEl.duration) * 100;
        const progressTextContent = `정밀 분석 중... (${Math.round(progress)}%)`;
        
        progressBarFill.style.width = `${progress}%`;
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });
    }

    if (allDetections.length === 0) {
        displayResults([], videoEl.duration);
        updateState({ status: 'completed' });
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '얼굴 분석 (V2)';
        progressContainer.style.display = 'none';
        return;
    }

    // 5. 정교한 인물 식별 클러스터링
    const clusteringProgressText = '탐지된 얼굴 그룹화 시작...';
    progressText.textContent = clusteringProgressText;
    updateState({ progressText: clusteringProgressText });

    const actors = [];
    const DISTANCE_THRESHOLD = 0.5; // 유사도 기준 (낮을수록 엄격)

    progressBarFill.style.width = '0%';
    const totalDetections = allDetections.length;

    for (const [index, detection] of allDetections.entries()) {
        let bestMatch = null;
        let minDistance = 1;

        const progress = ((index + 1) / totalDetections) * 100;
        const progressTextContent = `얼굴 그룹화 진행 중... (${index + 1}/${totalDetections})`;
        progressBarFill.style.width = `${progress}%`;
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });

        for (let i = 0; i < actors.length; i++) {
            const dist = faceapi.euclideanDistance(detection.descriptor, actors[i].avgDescriptor);
            if (dist < minDistance) {
                minDistance = dist;
                bestMatch = actors[i];
            }
        }

        if (bestMatch && minDistance < DISTANCE_THRESHOLD) {
            bestMatch.detections.push(detection);
            // 그룹의 평균 특징을 계속 업데이트하여 정확도 향상
            const newDescriptors = bestMatch.detections.map(d => d.descriptor);
            const avgDescriptor = new Float32Array(newDescriptors[0].length);
            for (let i = 0; i < avgDescriptor.length; i++) {
                avgDescriptor[i] = newDescriptors.reduce((sum, desc) => sum + desc[i], 0) / newDescriptors.length;
            }
            bestMatch.avgDescriptor = avgDescriptor;
        } else {
            // 새로운 인물 발견
            actors.push({
                id: `actor-${Date.now()}-${Math.random()}`, // 고유 ID 생성
                label: `인물 #${actors.length + 1}`,
                detections: [detection],
                avgDescriptor: detection.descriptor,
            });
        }
    }

    // 6. 데이터 집계 및 Best Shot 대표 이미지 추출
    const aggregationProgressText = '최종 데이터 집계 시작...';
    progressText.textContent = aggregationProgressText;
    updateState({ progressText: aggregationProgressText });

    const finalActors = [];

    progressBarFill.style.width = '0%';
    const totalActors = actors.length;

    for (const [index, actor] of actors.entries()) {
        const progress = ((index + 1) / totalActors) * 100;
        const progressTextContent = `인물별 Best Shot 선정 및 정보 정리 중... (${index + 1}/${totalActors}명)`;
        progressBarFill.style.width = `${progress}%`;
        progressText.textContent = progressTextContent;
        updateState({ progress: progress, progressText: progressTextContent });


        const bestDetection = actor.detections.reduce((best, current) =>
            current.detection.box.area > best.detection.box.area ? current : best
        );

        videoEl.currentTime = bestDetection.timestamp;
        await new Promise(resolve => { videoEl.onseeked = () => resolve(); });

        const faceCanvas = document.createElement('canvas');
        const { x, y, width, height } = bestDetection.detection.box;

        // 여권 사진처럼 보이도록 박스 확장 (세로 비율을 더 늘림)
        const widthScale = 1.5;
        const heightScale = 2.0;
        const newWidth = width * widthScale;
        const newHeight = height * heightScale;

        // 얼굴이 프레임의 상단 1/3 지점에 위치하도록 y 좌표 조정
        let newX = x - (newWidth - width) / 2;
        let newY = y - (newHeight - height) / 3;

        // 비디오 프레임 경계를 벗어나지 않도록 좌표 보정
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        const finalWidth = Math.min(newWidth, videoEl.videoWidth - newX);
        const finalHeight = Math.min(newHeight, videoEl.videoHeight - newY);

        faceCanvas.width = finalWidth;
        faceCanvas.height = finalHeight;
        faceCanvas.getContext('2d').drawImage(videoEl, newX, newY, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);

        const gender = actor.detections.map(d => d.gender).sort((a,b) => actor.detections.filter(v => v.gender===a).length - actor.detections.filter(v => v.gender===b).length).pop();
        const avgAge = actor.detections.reduce((sum, d) => sum + d.age, 0) / actor.detections.length;

        const emotionSummary = {};
        actor.detections.forEach(d => {
            const topEmotion = Object.keys(d.expressions).reduce((a, b) => d.expressions[a] > d.expressions[b] ? a : b);
            emotionSummary[topEmotion] = (emotionSummary[topEmotion] || 0) + 1;
        });

        finalActors.push({
            id: actor.id, // ID 유지
            label: actor.label,
            image: faceCanvas.toDataURL(),
            gender: gender === 'male' ? '남성' : '여성',
            avgAge: avgAge,
            emotionSummary: emotionSummary,
            totalAppearances: actor.detections.length,
            appearances: actor.detections.map(d => d.timestamp).sort((a,b) => a - b),
            detections: actor.detections // 원본 데이터 유지
        });
    }

    // 7. 결과 표시 및 정리
    displayResults(finalActors, videoEl.duration);
    workLogManager.addWorkLog('face-analysis', `V2 얼굴 분석 완료: ${finalActors.length}명 식별`);
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '얼굴 분석 (V2)';
    progressContainer.style.display = 'none';

    console.log('✅ V2(전문가) 얼굴 분석 완료.');
} 