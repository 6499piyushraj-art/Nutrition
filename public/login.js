"use strict";

const form = document.getElementById("login-form");
const button = document.getElementById("login-button");
const error = document.getElementById("login-error");

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    });
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || "Sign-in failed. Check your password and try again.");
    window.location.assign("/");
  } catch (err) {
    error.textContent = err.message || "Could not sign in. Please try again.";
  } finally {
    button.disabled = false;
    button.innerHTML = "Sign in <span aria-hidden=\"true\">→</span>";
  }
});
