const express = require('express');
const { Client } = require('@notionhq/client');
const multer = require('multer');
const { OpenAI } = require('openai');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static("public"));

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const notion = new Client({ auth: NOTION_API_KEY });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DATABASES = {
    vision: process.env.NOTION_DATABASE_ID_VISION,
    text: process.env.NOTION_DATABASE_ID_TEXT,
    image: process.env.NOTION_DATABASE_ID_IMAGE,
    chatbot: process.env.NOTION_DATABASE_ID_CHATBOT,
};

const upload = multer({ storage: multer.memoryStorage() });

/* ★★★★★ Socket.IO 초기화 시작 ★★★★★ */
const http = require('http');                      // HTTP 서버 모듈 불러오기
const server = http.createServer(app);             // Express 앱으로 HTTP 서버 생성
const { Server } = require('socket.io');           // Socket.IO Server 생성자 불러오기
const io = new Server(server);                     // Socket.IO 인스턴스 생성
/* ★★★★★ Socket.IO 초기화 끝 ★★★★★ */

/**
 * 🔹 `/check-activity` 엔드포인트 추가
 * - 클라이언트에서 활동 코드와 프롬프트 타입을 입력하면 호출
 * - Notion 데이터베이스에서 해당 활동 코드가 있는지 확인
 * - 존재하면 student_view (Vision, Text, Chatbot) 또는 prompt (Image) 반환
 * - 존재하지 않으면 에러 반환
 */
app.post('/check-activity', async (req, res) => {
    const { activityCode, promptType } = req.body;
    const databaseId = DATABASES[promptType];

    // 잘못된 프롬프트 타입일 경우
    if (!databaseId) {
        return res.status(400).json({ success: false, error: "잘못된 프롬프트 타입입니다." });
    }

    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            filter: { property: 'activity_code', rich_text: { equals: activityCode } },
        });

        // 활동 코드가 존재하지 않을 경우
        if (response.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드가 존재하지 않습니다." });
        }

        // Vision, Text, Chatbot의 경우 student_view 사용 / Image의 경우 prompt 사용
        const page = response.results[0];
        const prompt = promptType === "image"
            ? page.properties.prompt?.rich_text?.[0]?.text?.content || "프롬프트 없음"
            : page.properties.student_view?.rich_text?.[0]?.text?.content || "학생용 뷰 없음";

        res.json({ success: true, prompt });
    } catch (error) {
        console.error("Error checking Notion:", error);
        res.status(500).json({ success: false, error: "서버 오류 발생" });
    }
});

/**
 * 🔹 `/get-showing-word` 엔드포인트 (예: Vision)
 * - 학생 화면에 보여줄 프롬프트(student_view)를 반환
 */
app.get('/get-showing-word', async (req, res) => {
    const { activityCode } = req.query;

    try {
        const response = await notion.databases.query({
            database_id: DATABASES.vision,  // text, vision, chatbot의 경우 각각의 데이터베이스를 사용
            filter: { property: 'activity_code', rich_text: { equals: activityCode } },
        });

        if (response.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드가 존재하지 않습니다." });
        }

        // 학생에게 보여줄 프롬프트는 student_view 속성을 사용합니다.
        const studentView = response.results[0].properties.student_view?.rich_text?.[0]?.text?.content || "학생용 뷰 없음";
        res.json({ success: true, prompt: studentView });
    } catch (error) {
        console.error("Error fetching Notion (showing word):", error);
        res.status(500).json({ success: false, error: "서버 오류 발생" });
    }
});

/**
 * 🔹 `/analyze-image` 엔드포인트
 * - 업로드한 이미지를 OpenAI Vision API를 통해 분석
 * - 실제 분석에 사용할 프롬프트는 Notion의 prompt 속성을 사용합니다.
 */
app.post('/analyze-image', upload.single("image"), async (req, res) => {
    const { activityCode, studentName } = req.body;

    if (!activityCode) {
        return res.status(400).json({ success: false, error: "활동 코드가 필요합니다." });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: "이미지가 업로드되지 않았습니다." });
    }

    try {
        // Notion에서 실제 분석에 사용할 prompt 속성을 가져옵니다.
        const notionResponse = await notion.databases.query({
            database_id: DATABASES.vision, // 혹은 해당 이미지 전용 데이터베이스
            filter: { property: "activity_code", rich_text: { equals: activityCode.trim() } }
        });

        if (notionResponse.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드에 대한 프롬프트를 찾을 수 없습니다." });
        }

        // 실제 분석에 사용할 프롬프트는 prompt 속성을 사용합니다.
        const prompt = notionResponse.results[0].properties.prompt?.rich_text?.[0]?.text?.content || "프롬프트 없음";

        // 업로드한 이미지 데이터를 base64 인코딩 후 data URL 생성
        const imageBuffer = req.file.buffer.toString("base64");
        const mimeType = req.file.mimetype;
        const imageDataUrl = `data:${mimeType};base64,${imageBuffer}`;

        // OpenAI API 호출: 메시지의 content를 배열 형태로 구성 (텍스트와 이미지 객체 포함)
        const userMessage = {
            role: "user",
            content: [
                { type: "text", text: "다음 이미지를 분석해 주세요." },
                {
                    type: "image_url", // 이미지 URL 방식. Base64 데이터를 직접 지원하는 형식이 있다면 해당 형식으로 변경
                    image_url: { url: imageDataUrl }
                }
            ]
        };

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `프롬프트: ${prompt}` },
                userMessage,
            ],
            store: true,
        });

        const analysis = response.choices[0].message.content.trim();

        // 학생 활동 분석 후 업데이트 객체 생성
        const updateObj = {
            activityCode,                      // 학생이 입력한 활동 코드
            promptType: "vision",              // 활동 타입 (vision)
            studentName,                       // 학생 이름
            teacherPrompt: prompt,             // Notion에서 가져온 프롬프트 내용
            inputImage: imageDataUrl,          // 업로드한 이미지의 Data URL
            aiResult: analysis,                // 인공지능이 반환한 분석 결과
            date: new Date().toISOString()     // 현재 날짜 및 시간
        };

        console.log("Emitting promptUpdated event with:", updateObj);
        // 학생용 서버 내 Socket.IO 이벤트 emit
        io.emit("promptUpdated", updateObj);
        
        // 추가: 교사용 서버로 HTTP POST 요청 보내기
        try {
            const teacherResponse = await fetch('https://port-0-teachers-ai-nodejs-m6oc1d66fae356ac.sel4.cloudtype.app/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateObj)
            });
            const teacherResult = await teacherResponse.json();
            console.log("Notification sent to Teacher Server:", teacherResult);
        } catch (error) {
            console.error("Error sending notification to Teacher Server:", error);
        }
        
        res.json({ success: true, analysis });
    } catch (error) {
        console.error("OpenAI Vision API 오류:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "이미지 분석 실패" });
    }
});



app.post("/transform-text/:activityCode", async (req, res) => {
    const { studentInput, studentName } = req.body; // studentName 추가 (필요하다면)
    const { activityCode } = req.params; // URL에서 activityCode 가져오기

    if (!studentInput) {
        return res.status(400).json({ success: false, error: "학생 입력이 필요합니다." });
    }

    try {
        // Notion 데이터베이스에서 prompt 가져오기 (Text Generation 데이터베이스 사용)
        const personaResponse = await notion.databases.query({
            database_id: DATABASES.text,
            filter: { property: "activity_code", rich_text: { equals: activityCode } },
        });

        if (personaResponse.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드를 찾을 수 없습니다." });
        }

        const prompt = personaResponse.results[0].properties.prompt?.rich_text?.[0]?.text?.content || "프롬프트 없음";

        // OpenAI API 호출
        const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `프롬프트: ${prompt}` },
                { role: "user", content: studentInput },
            ],
        });

        const transformedText = openaiResponse.choices[0].message.content.trim();

        // 업데이트 객체 생성 (Text Generation)
        const updateObj = {
            activityCode,                      // 활동 코드
            promptType: "text",                // 프롬프트 타입 (text)
            studentName: studentName || "",     // 학생 이름 (필요 시)
            teacherPrompt: prompt,             // Notion에서 가져온 프롬프트
            inputText: studentInput,           // 학생이 입력한 원본 텍스트
            aiResult: transformedText,         // OpenAI가 생성한 텍스트 결과
            date: new Date().toISOString()     // 현재 날짜 및 시간
        };

        console.log("Emitting promptUpdated event for Text Generation with:", updateObj);
        // 학생용 서버 내 Socket.IO 이벤트 emit
        io.emit("promptUpdated", updateObj);

        // 교사용 서버로 HTTP POST 요청 보내기
        try {
            const teacherResponse = await fetch('https://port-0-teachers-ai-nodejs-m6oc1d66fae356ac.sel4.cloudtype.app/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateObj)
            });
            const teacherResult = await teacherResponse.json();
            console.log("Notification sent to Teacher Server (Text Generation):", teacherResult);
        } catch (error) {
            console.error("Error sending notification to Teacher Server (Text Generation):", error);
        }

        res.json({ success: true, transformedText });
    } catch (error) {
        console.error("Error during text transformation:", error);
        res.status(500).json({ success: false, error: "서버 요청 중 오류가 발생했습니다." });
    }
});


app.post("/chatbot/:activityCode", async (req, res) => {
    const { conversationHistory, userMessage, studentName } = req.body;
    const { activityCode } = req.params; // URL 파라미터에서 활동 코드 가져오기

    if (!userMessage) {
        return res.status(400).json({ success: false, error: "사용자 메시지가 필요합니다." });
    }

    console.log(`📡 Received chatbot request for activityCode: ${activityCode}`);

    try {
        // Notion 데이터베이스에서 prompt와 student_view 가져오기 (Chatbot 데이터베이스 사용)
        const personaResponse = await notion.databases.query({
            database_id: DATABASES.chatbot,
            filter: { property: "activity_code", rich_text: { equals: activityCode } },
        });

        if (personaResponse.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드에 대한 프롬프트를 찾을 수 없습니다." });
        }

        // 교사용 프롬프트 (예: teacherPrompt)
        const prompt = personaResponse.results[0].properties.prompt?.rich_text?.[0]?.text?.content || "프롬프트 없음";
        // 학생용 챗봇 뷰 (예: student_view) - 이 값을 사용해야 학생용 챗봇 화면이 올바르게 표시됩니다.
        const studentView = personaResponse.results[0].properties.student_view?.rich_text?.[0]?.text?.content || "";

        console.log(`🔹 Loaded persona prompt: ${prompt}`);
        console.log(`🔹 Loaded student view: ${studentView}`);

        // OpenAI API 호출
        const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `프롬프트: ${prompt}` },
                ...conversationHistory,
                { role: "user", content: userMessage },
            ],
        });

        const botResponse = openaiResponse.choices[0].message.content.trim();
        console.log("✅ OpenAI Response:", botResponse);

        // 업데이트 객체 생성 (Chatbot)
        const updateObj = {
            activityCode,                      // 활동 코드
            promptType: "chatbot",             // 프롬프트 타입 (chatbot)
            studentName: studentName || "",     // 학생 이름 (입력된 값 그대로)
            studentView: studentView,          // Notion에서 가져온 학생용 챗봇 뷰
            conversationHistory: conversationHistory || [],  // 대화 기록 배열
            aiResult: botResponse,             // 챗봇의 응답 결과
            date: new Date().toISOString()     // 현재 날짜 및 시간
        };

        console.log("Emitting promptUpdated event for Chatbot with:", updateObj);
        // 학생용 서버 내 Socket.IO 이벤트 emit
        io.emit("promptUpdated", updateObj);

        // 교사용 서버로 HTTP POST 요청 보내기
        try {
            const teacherResponse = await fetch('https://port-0-teachers-ai-nodejs-m6oc1d66fae356ac.sel4.cloudtype.app/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateObj)
            });
            const teacherResult = await teacherResponse.json();
            console.log("Notification sent to Teacher Server (Chatbot):", teacherResult);
        } catch (error) {
            console.error("Error sending notification to Teacher Server (Chatbot):", error);
        }

        res.json({ success: true, response: botResponse });
    } catch (error) {
        console.error("❌ Error during chatbot interaction:", error);
        res.status(500).json({ success: false, error: "챗봇 응답 실패" });
    }
});



app.get('/get-image-prompt', async (req, res) => {
    const { activityCode } = req.query;

    try {
        const response = await notion.databases.query({
            database_id: DATABASES.image,
            filter: { property: 'activity_code', rich_text: { equals: activityCode } },
        });

        if (response.results.length === 0) {
            return res.status(404).json({ success: false, error: "해당 활동 코드가 존재하지 않습니다." });
        }

        const page = response.results[0];
        const prompt = page.properties.prompt?.rich_text?.[0]?.text?.content || "프롬프트 없음";
        const adjectives = JSON.parse(page.properties.adjectives?.rich_text?.[0]?.text?.content || "[]");

        res.json({ success: true, prompt, adjectives });
    } catch (error) {
        console.error("Error fetching image prompt:", error);
        res.status(500).json({ success: false, error: "서버 오류 발생" });
    }
});

app.post('/generate-image', async (req, res) => {
    // 추가로 activityCode와 studentName를 요청 본문에서 받습니다.
    const { prompt, adjectives, activityCode, studentName } = req.body;

    if (!prompt || !adjectives || adjectives.length === 0 || !activityCode) {
        return res.status(400).json({ success: false, error: "프롬프트, 형용사, 그리고 활동 코드가 필요합니다." });
    }

    // 최종 프롬프트 구성: 형용사 목록과 원본 프롬프트를 결합
    const finalPrompt = `${adjectives.join(", ")} ${prompt}`;

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            size: "1024x1024",
        });

        const imageUrl = response.data[0].url;  // 생성된 이미지 URL

        // 업데이트 객체 생성 (이미지 생성용)
        const updateObj = {
            activityCode,                  // 학생이 입력한 활동 코드
            promptType: "image",           // 이미지 생성 타입
            studentName: studentName || "",// 학생 이름 (클라이언트에서 전달된 값)
            teacherPrompt: prompt,         // Notion에서 가져온 혹은 학생이 입력한 원본 프롬프트
            adjectives: adjectives.join(", "),  // 형용사 목록 (문자열로 결합)
            aiImage: imageUrl,             // 생성된 이미지의 URL (교사용 모니터링에서는 AI 결과로 사용)
            date: new Date().toISOString() // 현재 날짜 및 시간
        };

        console.log("Emitting promptUpdated event for Image Generation with:", updateObj);
        // 학생용 서버 내 Socket.IO 이벤트 emit (필요 시)
        io.emit("promptUpdated", updateObj);
        
        // 추가: 교사용 서버로 HTTP POST 요청 보내기
        try {
            const teacherResponse = await fetch('https://port-0-teachers-ai-nodejs-m6oc1d66fae356ac.sel4.cloudtype.app/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateObj)
            });
            const teacherResult = await teacherResponse.json();
            console.log("Notification sent to Teacher Server (Image Generation):", teacherResult);
        } catch (error) {
            console.error("Error sending notification to Teacher Server (Image Generation):", error);
        }

        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error("Error generating image:", error);
        res.status(500).json({ success: false, error: "이미지 생성 실패" });
    }
});




/**
 * 🔹 서버 실행
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

