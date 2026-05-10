export default function buildResponse({
  status = null,
  message = null,
  data = null,
  token = null,
} = {}) {
  return {
    status,
    message,
    data,
    token,
  };
}
