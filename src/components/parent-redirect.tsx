import { Navigate, useLocation } from "react-router-dom";

export function ParentRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "..", search }} relative="path" replace />;
}
