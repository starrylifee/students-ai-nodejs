document.getElementById("activity-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    const activityCode = document.getElementById("activity-code").value.trim();
    const promptType = document.getElementById("prompt-type").value;
    
    if (!activityCode) {
        alert("활동 코드를 입력하세요.");
        return;
    }

    try {
        const response = await fetch("/check-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityCode, promptType }),
        });

        const result = await response.json();
        if (result.success) {
            document.getElementById("prompt-preview").innerText = `🔹 ${result.prompt}`;
            document.getElementById("result-container").style.display = "block";
            
            document.getElementById("enter-button").onclick = function() {
                // 세부 활동 페이지로 바로 이동하는 대신 이름 입력 페이지로 리디렉션합니다.
                window.location.href = `/name.html?activity=${activityCode}&prompt=${encodeURIComponent(result.prompt)}&promptType=${promptType}`;
            };
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error("Error checking activity:", error);
        alert("서버 오류가 발생했습니다.");
    }
});
