document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded event fired");

    const transformButton = document.getElementById("transform-button");
    const backButton = document.getElementById("back-button");

    console.log("Transform Button:", transformButton);
    console.log("Back Button:", backButton);

    if (!transformButton || !backButton) {
        console.error("Button elements not found");
        return;
    }

    // URL에서 활동 코드 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const activityCode = urlParams.get("activity");
    const studentName = urlParams.get("name") || ""; // 학생 이름 추출 (없으면 빈 문자열)


    if (!activityCode) {
        alert("활동 코드가 누락되었습니다. 다시 시도해주세요.");
        console.error("No activity code in URL");
        window.location.href = "/";
        return;
    }
    console.log("Activity Code:", activityCode);

    // 변환하기 버튼 이벤트 리스너
    transformButton.addEventListener("click", async () => {
        console.log("Transform button clicked");

        const studentInput = document.getElementById("student-input").value.trim();
        if (!studentInput) {
            alert("학생 입력을 작성하세요.");
            return;
        }

        try {
            // ✅ URL에 activityCode 추가하여 요청
            console.log(`Sending fetch request to /transform-text/${activityCode}`);
            const response = await fetch(`/transform-text/${activityCode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentInput, studentName }), // ✅ activityCode는 URL에 포함
            });

            console.log("Fetch request sent, waiting for response...");
            const result = await response.json();
            console.log("Response received:", result);

            if (result.success) {
                document.getElementById("ai-result").innerText = result.transformedText;
            } else {
                alert(result.error || "변환에 실패했습니다.");
            }
        } catch (error) {
            console.error("Error during fetch request:", error);
            alert("서버 요청 중 오류가 발생했습니다.");
        }
    });

    // 처음으로 돌아가기 버튼 이벤트 리스너
    backButton.addEventListener("click", () => {
        console.log("Back button clicked");
        window.location.href = "/";
    });
});
