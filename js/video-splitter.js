// js/video-splitter.js

import { state } from './state.js';
import * as FFmpeg from '@ffmpeg/ffmpeg';
import * as FFmpegUtil from '@ffmpeg/util';

let ffmpeg;
let isFFmpegLoaded = false;
let ffmpegLogs = []; // FFmpeg 로그를 저장할 배열
let outputFolderHandle = null;

// FFmpeg 초기화
async function initializeFFmpeg() {
    if (isFFmpegLoaded) return;
    
    // createFFmpeg 함수 호출 방식 변경
    ffmpeg = new FFmpeg.FFmpeg();
    
    // 로그 이벤트를 받아서 배열에 저장
    ffmpeg.on('log', ({ message }) => {
      console.log(message);
      ffmpegLogs.push(message);
    });

    ffmpeg.on('progress', ({ ratio }) => {
        console.log(`FFmpeg Progress: ${(ratio * 100).toFixed(2)}%`);
    });

    // Core URL 로드 방식 변경
    await ffmpeg.load({
        coreURL: await FFmpegUtil.toBlobURL('/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', 'application/javascript'),
        wasmURL: await FFmpegUtil.toBlobURL('/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'application/wasm')
    });
    
    isFFmpegLoaded = true;
    console.log('✅ FFmpeg for video splitting initialized.');
}

// hh:mm:ss 형식으로 변환
function formatDuration(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}

// 영상 분할 및 저장
export async function splitVideo(splitDurationMinutes) {
    if (!state.uploadedFile) {
        alert('분할할 영상을 먼저 업로드해주세요.');
        return;
    }

    ffmpegLogs = []; // 새 작업 시작 시 로그 초기화

    try {
        outputFolderHandle = await window.showDirectoryPicker();
        console.log(`📁 Selected output folder: ${outputFolderHandle.name}`);

        await initializeFFmpeg();
        
        const splitDurationSeconds = splitDurationMinutes * 60;
        const originalFile = state.uploadedFile;
        // 내부 처리용 파일 이름 단순화
        const internalInputName = `input.${originalFile.name.split('.').pop()}`;
        
        const fileData = await FFmpegUtil.fetchFile(originalFile);
        await ffmpeg.writeFile(internalInputName, fileData);

        // 영상 길이 가져오기 (이 부분은 ffmpeg.probe 사용을 고려해볼 수 있으나, 일단 유지)
        const { duration } = await ffmpeg.ffprobe(internalInputName);

        if (!duration) {
            alert('영상의 길이를 확인할 수 없습니다.');
            return;
        }

        const numSegments = Math.ceil(duration / splitDurationSeconds);
        alert(`총 ${numSegments}개의 파일로 분할을 시작합니다.\n안정적인 처리를 위해 시간이 다소 걸릴 수 있습니다.`);

        for (let i = 0; i < numSegments; i++) {
            const startTime = i * splitDurationSeconds;
            // 내부 처리용 출력 파일 이름
            const internalOutputName = `part_${i + 1}.mp4`;
            // 사용자에게 보여주고 저장할 실제 파일 이름
            const finalOutputName = `part_${i + 1}_${originalFile.name}`;
            
            console.log(`Splitting part ${i + 1}/${numSegments}...`);
            // 진행 상황 UI 업데이트
            alert(`[${i + 1}/${numSegments}] 파일 분할 중...\n파일명: ${finalOutputName}`);

            // 안정성을 위해 re-encoding 방식으로 변경 (-c copy 대신)
            await ffmpeg.exec([
                '-i', internalInputName, // 단순화된 이름 사용
                '-ss', formatDuration(startTime),
                '-t', formatDuration(splitDurationSeconds),
                '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac',
                internalOutputName // 단순화된 이름 사용
            ]);

            const data = await ffmpeg.readFile(internalOutputName);
            
            // 파일 핸들 생성 및 저장
            const fileHandle = await outputFolderHandle.getFileHandle(finalOutputName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();

            console.log(`✅ Saved ${finalOutputName} to ${outputFolderHandle.name}`);
            await ffmpeg.deleteFile(internalOutputName);
        }

        await ffmpeg.deleteFile(internalInputName);
        alert(`✅ 영상 분할 완료! 총 ${numSegments}개의 파일이 선택한 폴더에 저장되었습니다.`);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('사용자가 폴더 선택을 취소했습니다.');
        } else {
            console.error('❌ 영상 분할 중 오류 발생:', error);
            // 오류 발생 시 상세 로그를 함께 보여줌
            const detailedError = ffmpegLogs.slice(-5).join('\n'); // 마지막 5줄의 로그를 가져옴
            alert(`영상 분할 중 오류가 발생했습니다: ${error.message}\n\n[상세 정보]\n${detailedError}`);
        }
    }
} 