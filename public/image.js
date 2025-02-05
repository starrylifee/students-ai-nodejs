document.addEventListener("DOMContentLoaded", async () => {
    console.log("Image Generation Page Loaded");

    const urlParams = new URLSearchParams(window.location.search);
    const activityCode = urlParams.get("activity");
    const studentName = urlParams.get("name") || ""; // 학생 이름 추출 (없으면 빈 문자열)

    if (!activityCode) {
        alert("활동 코드가 없습니다.");
        window.location.href = "/";
        return;
    }

    console.log("Activity Code:", activityCode);

    try {
        // Notion에서 프롬프트 및 형용사 가져오기
        const response = await fetch(`/get-image-prompt?activityCode=${activityCode}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById("prompt-text").innerText = `📌 활동 코드: ${activityCode}\n📝 ${result.prompt}`;

            const adjectivesContainer = document.getElementById("adjectives-container");
            result.adjectives.forEach(adj => {
                const span = document.createElement("span");
                span.classList.add("adjective");
                span.innerText = adj;
                span.addEventListener("click", () => toggleAdjective(span));
                adjectivesContainer.appendChild(span);
            });
        } else {
            alert(result.error);
            window.location.href = "/";
        }
    } catch (error) {
        console.error("Error fetching prompt:", error);
        alert("서버 오류가 발생했습니다.");
        window.location.href = "/";
    }

    // 형용사 선택 기능
    function toggleAdjective(span) {
        span.classList.toggle("selected");
        const selected = document.querySelectorAll(".adjective.selected");
        if (selected.length > 2) {
            span.classList.remove("selected");
            alert("형용사는 최대 2개까지만 선택할 수 있습니다.");
        }
    }

    // 이미지 생성 요청
    document.getElementById("generate-button").addEventListener("click", async () => {
        console.log("Generate button clicked");

        const selectedAdjectives = Array.from(document.querySelectorAll(".adjective.selected"))
            .map(span => span.innerText);

        if (selectedAdjectives.length === 0) {
            alert("최소 1개의 형용사를 선택하세요.");
            return;
        }

        const prompt = document.getElementById("prompt-text").innerText.split("\n📝 ")[1];

        document.getElementById("loading").style.display = "block";

        try {
            const response = await fetch("/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activityCode, prompt, adjectives: selectedAdjectives, studentName }),
            });

            const result = await response.json();
            document.getElementById("loading").style.display = "none";

            if (result.success) {
                document.getElementById("generated-image").src = result.imageUrl;
                document.getElementById("image-result").style.display = "block";
            } else {
                alert(result.error || "이미지 생성에 실패했습니다.");
            }
        } catch (error) {
            console.error("Error generating image:", error);
            alert("서버 오류가 발생했습니다.");
        }
    });

    document.getElementById("back-button").addEventListener("click", () => {
        window.location.href = "/";
    });
});
