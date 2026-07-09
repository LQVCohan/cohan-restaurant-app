import React from "react";
import "./AppErrorBoundary.scss";

const MODULE_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk|module script/i;
const CONNECTION_ERROR_PATTERN =
  /failed to fetch|network request failed|networkerror|database|mongo|connection/i;

export const getFriendlyAppError = (error) => {
  const message = String(error?.message || error || "");

  if (MODULE_LOAD_ERROR_PATTERN.test(message)) {
    return {
      code: "UI-LOAD",
      title: "Không thể tải trang vừa chọn",
      description:
        "Một phần giao diện chưa tải được. Trường hợp này thường xảy ra sau khi ứng dụng vừa được cập nhật hoặc kết nối bị gián đoạn.",
    };
  }

  if (CONNECTION_ERROR_PATTERN.test(message)) {
    return {
      code: "DATA-CONNECTION",
      title: "Hệ thống đang tạm gián đoạn",
      description:
        "Ứng dụng chưa kết nối được đến dữ liệu. Thao tác chưa hoàn tất và bạn có thể thử lại sau ít phút.",
    };
  }

  return {
    code: "UI-UNEXPECTED",
    title: "Trang này đang gặp sự cố",
    description:
      "Ứng dụng không thể tiếp tục hiển thị trang hiện tại. Hãy tải lại trang hoặc quay về trang chính.",
  };
};

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    const target = window.location.pathname.startsWith("/manager")
      ? "/manager#dashboard"
      : "/";
    window.location.assign(target);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const friendlyError = getFriendlyAppError(error);

    return (
      <main className="app-error-boundary" role="alert" aria-live="assertive">
        <section className="app-error-boundary__panel">
          <div className="app-error-boundary__mark" aria-hidden="true">
            !
          </div>
          <span className="app-error-boundary__eyebrow">
            Cohan Restaurant · {friendlyError.code}
          </span>
          <h1>{friendlyError.title}</h1>
          <p>{friendlyError.description}</p>

          <div className="app-error-boundary__actions">
            <button type="button" className="primary" onClick={this.handleReload}>
              Tải lại trang
            </button>
            <button type="button" onClick={this.handleGoHome}>
              Về trang chính
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;