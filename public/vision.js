document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired for Vision page");

  // 요소 선택
  const imageUpload = document.getElementById("image-upload");
  const imagePreview = document.getElementById("image-preview");
  const analyzeButton = document.getElementById("analyze-button");
  const backButton = document.getElementById("back-button");
  const analysisResult = document.getElementById("analysis-result");

  // URL에서 활동 코드(activity)와 학생 이름(name) 추출
  const urlParams = new URLSearchParams(window.location.search);
  const activityCode = urlParams.get("activity");
  const studentName = urlParams.get("name") || "기본 학생 이름";  // 학생 이름 추출, 없으면 기본값 사용

  if (!activityCode) {
    alert("활동 코드가 누락되었습니다. 다시 시도해주세요.");
    console.error("No activity code in URL");
    window.location.href = "/";
    return;
  }
  console.log("Activity Code:", activityCode);
  console.log("Student Name:", studentName);

  // 이미지 업로드 시 미리보기 표시
  imageUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // 분석 시작 버튼 클릭 시 이벤트 처리
  analyzeButton.addEventListener("click", async () => {
    console.log("Analyze button clicked");

    const file = imageUpload.files[0];
    if (!file) {
      alert("이미지를 업로드 해주세요.");
      return;
    }

    // FormData를 사용하여 이미지, 활동 코드, 학생 이름 전송
    const formData = new FormData();
    formData.append("image", file);
    formData.append("activityCode", activityCode);
    formData.append("studentName", studentName);  // 학생 이름 추가

    try {
      console.log("Sending fetch request to /analyze-image");
      const response = await fetch("/analyze-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Response received:", result);

      if (result.success) {
        analysisResult.innerText = result.analysis;
      } else {
        alert(result.error || "이미지 분석에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error during fetch request:", error);
      alert("서버 요청 중 오류가 발생했습니다.");
    }
  });

  // 처음으로 돌아가기 버튼 클릭 시 홈으로 이동
  backButton.addEventListener("click", () => {
    console.log("Back button clicked");
    window.location.href = "/";
  });
});
