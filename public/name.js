document.addEventListener("DOMContentLoaded", () => {
    // URL에서 필요한 값들을 가져옴 (활동코드, 프롬프트, 프롬프트 타입)
    const urlParams = new URLSearchParams(window.location.search);
    const activityCode = urlParams.get("activity");
    const prompt = urlParams.get("prompt") || "";
    const promptType = urlParams.get("promptType") || "";
  
    if (!activityCode) {
      alert("활동 코드가 없습니다. 다시 시도해주세요.");
      window.location.href = "/";
      return;
    }
  
    // 이름 입력 폼 제출 이벤트 핸들러
    document.getElementById("name-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const studentName = document.getElementById("student-name").value.trim();
      if (!studentName) {
        alert("이름을 입력하세요.");
        return;
      }
      // 선택한 프롬프트 타입에 맞게 세부활동 페이지로 이동하며, URL에 활동코드와 학생 이름을 포함
      window.location.href = `/${promptType}.html?activity=${activityCode}&name=${encodeURIComponent(studentName)}`;
    });
  });
  