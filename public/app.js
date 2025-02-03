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
                window.location.href = `/${promptType}.html?activity=${activityCode}`;
            };
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error("Error checking activity:", error);
        alert("서버 오류가 발생했습니다.");
    }
});
