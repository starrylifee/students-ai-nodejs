document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded event fired");

    const chatLog = document.getElementById("chat-log");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const backButton = document.getElementById("back-button");

    let conversationHistory = [];

    // ✅ URL에서 activityCode 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const activityCode = urlParams.get("activity");
    const studentName = urlParams.get("name") || ""; // 학생 이름 추출 (없으면 빈 문자열)


    if (!activityCode) {
        alert("⚠️ 활동 코드가 없습니다. 다시 시도해주세요.");
        window.location.href = "/";
        return;
    }
    console.log("✅ 활동 코드:", activityCode); // 디버깅용 로그 추가

    // 메시지를 채팅 로그에 추가하는 헬퍼 함수
    function addMessageToChatLog(message, sender) {
        const messageHTML = sender === "user"
            ? `<p class="user-message">나: ${message}</p>`
            : `<p class="bot-message">챗봇: ${message}</p>`;
        chatLog.innerHTML += messageHTML;
        // 스크롤을 자동으로 하단으로 이동
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    // 메시지 전송 함수
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) {
            alert("메시지를 입력하세요.");
            return;
        }

        // 메시지 값을 변수에 저장한 후, 입력란을 즉시 비웁니다.
        userInput.value = "";

        console.log("📨 Sending message to chatbot:", message);

        // 사용자 메시지를 채팅 로그에 먼저 추가
        addMessageToChatLog(message, "user");

        // 활동 코드와 함께 서버에 요청
        try {
            const response = await fetch(`/chatbot/${activityCode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationHistory, userMessage: message }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log("✅ Response received:", result);

            if (result.success) {
                const botMessage = result.response;
                addMessageToChatLog(botMessage, "bot");
                conversationHistory.push({ role: "user", content: message });
                conversationHistory.push({ role: "assistant", content: botMessage });
            } else {
                alert(result.error || "챗봇 응답에 실패했습니다.");
            }
        } catch (error) {
            console.error("❌ Error during chatbot request:", error);
            alert("서버 요청 중 오류가 발생했습니다.");
        }
    }

    // 전송 버튼 클릭 이벤트
    sendButton.addEventListener("click", sendMessage);

    // 엔터 키로 메시지 전송 (Shift+Enter는 줄바꿈)
    userInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault(); // 기본 줄바꿈 동작 방지
            sendMessage();
        }
    });

    // '처음으로 돌아가기' 버튼 클릭 이벤트
    backButton.addEventListener("click", () => {
        window.location.href = "/";
    });
});
