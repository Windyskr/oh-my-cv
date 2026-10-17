<template>
  <div>
    <SharedHeader />
    <main class="max-w-100 mx-auto px-5 py-12">
      <h1 class="text-2xl font-bold">{{ register ? "创建账户" : "登录简历账户" }}</h1>
      <p class="mt-3 text-sm text-muted-foreground">
        登录后，简历和历史记录会保存在云端，网页与 Agent 共用同一份数据。
      </p>
      <form class="space-y-4 mt-6" @submit.prevent="submit">
        <div class="space-y-2">
          <label for="auth-username">用户名</label
          ><UiInput
            id="auth-username"
            v-model="username"
            autocomplete="username"
            minlength="3"
            maxlength="40"
            required
          />
        </div>
        <div class="space-y-2">
          <label for="auth-password">密码</label
          ><UiInput
            id="auth-password"
            v-model="password"
            type="password"
            :autocomplete="register ? 'new-password' : 'current-password'"
            minlength="12"
            maxlength="128"
            required
          />
          <p class="text-xs text-muted-foreground">密码需要 12–128 个字符。</p>
        </div>
        <div v-if="register" class="space-y-2">
          <label for="auth-confirm">确认密码</label
          ><UiInput
            id="auth-confirm"
            v-model="confirmation"
            type="password"
            autocomplete="new-password"
            required
          />
        </div>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <UiButton id="auth-submit" class="w-full" type="submit" :disabled="busy">{{
          busy ? "正在处理…" : register ? "注册并登录" : "登录"
        }}</UiButton>
        <UiButton
          id="auth-toggle"
          class="w-full"
          variant="ghost"
          type="button"
          :disabled="busy"
          @click="
            register = !register;
            error = '';
          "
          >{{ register ? "已有账户？前往登录" : "没有账户？创建账户" }}</UiButton
        >
      </form>
    </main>
  </div>
</template>
<script setup lang="ts">
const auth = useCloudAuth();
const route = useRoute();
const localePath = useLocalePath();
const username = ref("");
const password = ref("");
const confirmation = ref("");
const register = ref(false);
const busy = ref(false);
const error = ref("");
const destination = () => {
  const next = route.query.next;
  return typeof next === "string" &&
    /^\/(?:en\/|sp\/|zh-cn\/)?(?:dashboard|editor\/\d+|account)(?:[/?]|$)/.test(next)
    ? next
    : localePath("/dashboard");
};
onMounted(async () => {
  if (await auth.load(true)) await navigateTo(destination());
});
const submit = async () => {
  if (busy.value) return;
  error.value = "";
  if (register.value && password.value !== confirmation.value) {
    error.value = "两次输入的密码不一致";
    return;
  }
  busy.value = true;
  try {
    await auth.signIn(username.value, password.value, register.value);
    password.value = "";
    confirmation.value = "";
    await navigateTo(destination());
  } catch (failure) {
    error.value =
      (failure as { data?: { error: string } }).data?.error ||
      "登录失败，请检查用户名、密码和网络连接";
  } finally {
    busy.value = false;
  }
};
</script>
