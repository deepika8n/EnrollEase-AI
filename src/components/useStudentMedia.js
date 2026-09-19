import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { fetchStudentMedia } from "../services/studentMediaService";

export default function useStudentMedia(studentId, enrollmentId, originals = false) {
  const { authUser, demoMode } = useApp();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: "", urls: {}, loading: false, error: "" });
  const key = `${authUser?.id || ""}:${studentId || ""}:${enrollmentId || ""}:${originals}`;
  const enabled = !demoMode && Boolean(authUser?.id && studentId && enrollmentId);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    setState({ key, urls: {}, loading: true, error: "" });
    void fetchStudentMedia(supabase, { studentId, enrollmentId, originals, signal: controller.signal,
      onProgress: urls => { if (active) setState({ key, urls, loading: true, error: "" }); },
    })
      .then(urls => { if (active) setState({ key, urls, loading: false, error: "" }); })
      .catch(() => {
        if (active) setState(prev => ({ ...prev, key, loading: false, error: "Photos and documents could not be loaded. Retry to view them." }));
      }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, enabled, attempt, studentId, enrollmentId, originals]);
  return {
    ...(state.key === key ? state : { urls: {}, loading: enabled, error: "" }),
    retry: () => setAttempt(value => value + 1),
  };
}
