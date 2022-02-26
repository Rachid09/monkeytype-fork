import type FirebaseTypes from "firebase";
import Ape from "../ape";
import * as AccountController from "../controllers/account-controller";
import * as DB from "../db";
import * as UpdateConfig from "../config";
import * as Loader from "../elements/loader";
import * as Notifications from "../elements/notifications";
import * as Settings from "../pages/settings";

type Input = {
  placeholder: string;
  type?: string;
  initVal: string;
  hidden?: boolean;
};

export const list: { [key: string]: SimplePopup } = {};
class SimplePopup {
  parameters: string[];
  wrapper: JQuery;
  element: JQuery;
  id: string;
  type: string;
  title: string;
  inputs: Input[];
  text: string;
  buttonText: string;
  execFn: (thisPopup: SimplePopup, ...params: string[]) => void | Promise<void>;
  beforeShowFn: (thisPopup: SimplePopup) => void;
  constructor(
    id: string,
    type: string,
    title: string,
    inputs: Input[] = [],
    text = "",
    buttonText = "Confirm",
    execFn: (
      thisPopup: SimplePopup,
      ...params: string[]
    ) => void | Promise<void>,
    beforeShowFn: (thisPopup: SimplePopup) => void
  ) {
    this.parameters = [];
    this.id = id;
    this.type = type;
    this.execFn = (thisPopup, ...vals): Promise<void> | void =>
      execFn(thisPopup, ...vals);
    this.title = title;
    this.inputs = inputs;
    this.text = text;
    this.wrapper = $("#simplePopupWrapper");
    this.element = $("#simplePopup");
    this.buttonText = buttonText;
    this.beforeShowFn = (thisPopup): void => beforeShowFn(thisPopup);
  }
  reset(): void {
    this.element.html(`
    <div class="title"></div>
    <div class="inputs"></div>
    <div class="text"></div>
    <div class="button"></div>`);
  }

  init(): void {
    const el = this.element;
    el.find("input").val("");
    // if (el.attr("popupId") !== this.id) {
    this.reset();
    el.attr("popupId", this.id);
    el.find(".title").text(this.title);
    el.find(".text").text(this.text);

    this.initInputs();

    if (this.buttonText === "") {
      el.find(".button").remove();
    } else {
      el.find(".button").text(this.buttonText);
    }

    // }
  }

  initInputs(): void {
    const el = this.element;
    if (this.inputs.length > 0) {
      if (this.type === "number") {
        this.inputs.forEach((input) => {
          el.find(".inputs").append(`
            <input
              type="number"
              min="1"
              val="${input.initVal}"
              placeholder="${input.placeholder}"
              class="${input.hidden ? "hidden" : ""}"
              ${input.hidden ? "" : "required"}
              autocomplete="off"
            >
          `);
        });
      } else if (this.type === "text") {
        this.inputs.forEach((input) => {
          if (input.type) {
            el.find(".inputs").append(`
              <input
                type="${input.type}"
                val="${input.initVal}"
                placeholder="${input.placeholder}"
                class="${input.hidden ? "hidden" : ""}"
                ${input.hidden ? "" : "required"}
                autocomplete="off"
              >
            `);
          } else {
            el.find(".inputs").append(`
              <input
                type="text"
                val="${input.initVal}"
                placeholder="${input.placeholder}"
                class="${input.hidden ? "hidden" : ""}"
                ${input.hidden ? "" : "required"}
                autocomplete="off"
              >
            `);
          }
        });
      }
      el.find(".inputs").removeClass("hidden");
    } else {
      el.find(".inputs").addClass("hidden");
    }
  }

  exec(): void {
    const vals: string[] = [];
    $.each($("#simplePopup input"), (_, el) => {
      vals.push($(el).val() as string);
    });
    this.execFn(this, ...vals);
    this.hide();
  }

  show(parameters: string[] = []): void {
    this.parameters = parameters;
    this.beforeShowFn(this);
    this.init();
    this.wrapper
      .stop(true, true)
      .css("opacity", 0)
      .removeClass("hidden")
      .animate({ opacity: 1 }, 125, () => {
        $($("#simplePopup").find("input")[0]).focus();
      });
  }

  hide(): void {
    this.wrapper
      .stop(true, true)
      .css("opacity", 1)
      .removeClass("hidden")
      .animate({ opacity: 0 }, 125, () => {
        this.wrapper.addClass("hidden");
      });
  }
}

export function hide(): void {
  $("#simplePopupWrapper")
    .stop(true, true)
    .css("opacity", 1)
    .removeClass("hidden")
    .animate({ opacity: 0 }, 125, () => {
      $("#simplePopupWrapper").addClass("hidden");
    });
}

$("#simplePopupWrapper").mousedown((e) => {
  if ($(e.target).attr("id") === "simplePopupWrapper") {
    $("#simplePopupWrapper")
      .stop(true, true)
      .css("opacity", 1)
      .removeClass("hidden")
      .animate({ opacity: 0 }, 125, () => {
        $("#simplePopupWrapper").addClass("hidden");
      });
  }
});

$(document).on("click", "#simplePopupWrapper .button", () => {
  const id = $("#simplePopup").attr("popupId") ?? "";
  list[id].exec();
});

$(document).on("keyup", "#simplePopupWrapper input", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const id = $("#simplePopup").attr("popupId") ?? "";
    list[id].exec();
  }
});

list["updateEmail"] = new SimplePopup(
  "updateEmail",
  "text",
  "Update Email",
  [
    {
      placeholder: "Password",
      type: "password",
      initVal: "",
    },
    {
      placeholder: "New email",
      initVal: "",
    },
    {
      placeholder: "Confirm new email",
      initVal: "",
    },
  ],
  "",
  "Update",
  async (_thisPopup, password, email, emailConfirm) => {
    try {
      const user = firebase.auth().currentUser;
      if (email !== emailConfirm) {
        Notifications.add("Emails don't match", 0);
        return;
      }
      if (user.providerData[0].providerId === "password") {
        const credential = firebase.auth.EmailAuthProvider.credential(
          user.email,
          password
        );
        await user.reauthenticateWithCredential(credential);
      }

      Loader.show();
      const response = await Ape.users.updateEmail(email, user.email);
      Loader.hide();

      if (response.status !== 200) {
        return Notifications.add(
          "Failed to update email: " + response.message,
          -1
        );
      }

      Notifications.add("Email updated", 1);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      const typedError = e as FirebaseTypes.FirebaseError;
      if (typedError.code === "auth/wrong-password") {
        Notifications.add("Incorrect password", -1);
      } else {
        Notifications.add("Something went wrong: " + e, -1);
      }
    }
  },
  (thisPopup) => {
    const user: FirebaseTypes.User = firebase.auth().currentUser;
    if (!user.providerData.find((p) => p?.providerId === "password")) {
      thisPopup.inputs = [];
      thisPopup.buttonText = "";
      thisPopup.text = "Password authentication is not enabled";
    }
  }
);

list["updateName"] = new SimplePopup(
  "updateName",
  "text",
  "Update Name",
  [
    {
      placeholder: "Password",
      type: "password",
      initVal: "",
    },
    {
      placeholder: "New name",
      type: "text",
      initVal: "",
    },
  ],
  "",
  "Update",
  async (_thisPopup, pass, newName) => {
    try {
      const user = firebase.auth().currentUser;
      if (user.providerData[0].providerId === "password") {
        const credential = firebase.auth.EmailAuthProvider.credential(
          user.email,
          pass
        );
        await user.reauthenticateWithCredential(credential);
      } else if (user.providerData[0].providerId === "google.com") {
        await user.reauthenticateWithPopup(AccountController.gmailProvider);
      }
      Loader.show();

      const checkNameResponse = await Ape.users.getNameAvailability(newName);
      if (checkNameResponse.status !== 200) {
        Loader.hide();
        return Notifications.add(
          "Failed to check name: " + checkNameResponse.message,
          -1
        );
      }

      const updateNameResponse = await Ape.users.updateName(newName);
      if (updateNameResponse.status !== 200) {
        Loader.hide();
        return Notifications.add(
          "Failed to update name: " + updateNameResponse.message,
          -1
        );
      }

      Notifications.add("Name updated", 1);
      DB.getSnapshot().name = newName;
      $("#menu .icon-button.account .text").text(newName);
    } catch (e) {
      const typedError = e as FirebaseTypes.FirebaseError;
      if (typedError.code === "auth/wrong-password") {
        Notifications.add("Incorrect password", -1);
      } else {
        Notifications.add("Something went wrong: " + e, -1);
      }
    }
    Loader.hide();
  },
  (thisPopup) => {
    const user = firebase.auth().currentUser;
    if (user.providerData[0].providerId === "google.com") {
      thisPopup.inputs[0].hidden = true;
      thisPopup.buttonText = "Reauthenticate to update";
    }
  }
);

list["updatePassword"] = new SimplePopup(
  "updatePassword",
  "text",
  "Update Password",
  [
    {
      placeholder: "Password",
      type: "password",
      initVal: "",
    },
    {
      placeholder: "New password",
      type: "password",
      initVal: "",
    },
    {
      placeholder: "Confirm new password",
      type: "password",
      initVal: "",
    },
  ],
  "",
  "Update",
  async (_thisPopup, previousPass, newPass, newPassConfirm) => {
    try {
      const user = firebase.auth().currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email,
        previousPass
      );
      if (newPass !== newPassConfirm) {
        Notifications.add("New passwords don't match", 0);
        return;
      }
      Loader.show();
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPass);
      Loader.hide();
      Notifications.add("Password updated", 1);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      const typedError = e as FirebaseTypes.FirebaseError;
      Loader.hide();
      if (typedError.code === "auth/wrong-password") {
        Notifications.add("Incorrect password", -1);
      } else {
        Notifications.add("Something went wrong: " + e, -1);
      }
    }
  },
  (thisPopup) => {
    const user: FirebaseTypes.User = firebase.auth().currentUser;
    if (!user.providerData.find((p) => p?.providerId === "password")) {
      thisPopup.inputs = [];
      thisPopup.buttonText = "";
      thisPopup.text = "Password authentication is not enabled";
    }
  }
);

list["addPasswordAuth"] = new SimplePopup(
  "addPasswordAuth",
  "text",
  "Add Password Authentication",
  [
    {
      placeholder: "email",
      type: "email",
      initVal: "",
    },
    {
      placeholder: "confirm email",
      type: "email",
      initVal: "",
    },
    {
      placeholder: "new password",
      type: "password",
      initVal: "",
    },
    {
      placeholder: "confirm new password",
      type: "password",
      initVal: "",
    },
  ],
  "",
  "Add",
  async (_thisPopup, email, emailConfirm, pass, passConfirm) => {
    if (email !== emailConfirm) {
      Notifications.add("Emails don't match", 0);
      return;
    }

    if (pass !== passConfirm) {
      Notifications.add("Passwords don't match", 0);
      return;
    }

    await AccountController.addPasswordAuth(email, pass);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  },
  () => {
    //
  }
);

list["deleteAccount"] = new SimplePopup(
  "deleteAccount",
  "text",
  "Delete Account",
  [
    {
      placeholder: "Password",
      type: "password",
      initVal: "",
    },
  ],
  "This is the last time you can change your mind. After pressing the button everything is gone.",
  "Delete",
  async (_thisPopup, password: string) => {
    //
    try {
      const user = firebase.auth().currentUser;
      if (user.providerData[0].providerId === "password") {
        const credential = firebase.auth.EmailAuthProvider.credential(
          user.email,
          password
        );
        await user.reauthenticateWithCredential(credential);
      } else if (user.providerData[0].providerId === "google.com") {
        await user.reauthenticateWithPopup(AccountController.gmailProvider);
      }
      Loader.show();
      Notifications.add("Deleting stats...", 0);
      const usersResponse = await Ape.users.delete();
      Loader.hide();

      if (usersResponse.status !== 200) {
        return Notifications.add(
          "Failed to delete user stats: " + usersResponse.message,
          -1
        );
      }

      Loader.show();
      Notifications.add("Deleting results...", 0);
      const resultsResponse = await Ape.results.deleteAll();
      Loader.hide();

      if (resultsResponse.status !== 200) {
        return Notifications.add(
          "Failed to delete user results: " + resultsResponse.message,
          -1
        );
      }

      Notifications.add("Deleting login information...", 0);
      await firebase.auth().currentUser.delete();

      Notifications.add("Goodbye", 1, 5);

      setTimeout(() => {
        location.reload();
      }, 3000);
    } catch (e) {
      const typedError = e as FirebaseTypes.FirebaseError;
      Loader.hide();
      if (typedError.code === "auth/wrong-password") {
        Notifications.add("Incorrect password", -1);
      } else {
        Notifications.add("Something went wrong: " + e, -1);
      }
    }
  },
  (thisPopup) => {
    const user = firebase.auth().currentUser;
    if (user.providerData[0].providerId === "google.com") {
      thisPopup.inputs = [];
      thisPopup.buttonText = "Reauthenticate to delete";
    }
  }
);

list["clearTagPb"] = new SimplePopup(
  "clearTagPb",
  "text",
  "Clear Tag PB",
  [],
  `Are you sure you want to clear this tags PB?`,
  "Clear",
  async (thisPopup) => {
    const tagId = thisPopup.parameters[0];
    Loader.show();
    const response = await Ape.users.deleteTagPersonalBest(tagId);
    Loader.hide();

    if (response.status !== 200) {
      return Notifications.add(
        "Failed to delete tag's PB: " + response.message
      );
    }

    if (response.data.resultCode === 1) {
      const tag = DB.getSnapshot().tags?.filter((t) => t._id === tagId)[0];

      if (tag === undefined) return;
      tag.personalBests = {
        time: {},
        words: {},
        zen: { zen: [] },
        quote: { custom: [] },
        custom: { custom: [] },
      };
      $(
        `.pageSettings .section.tags .tagsList .tag[id="${tagId}"] .clearPbButton`
      ).attr("aria-label", "No PB found");
      Notifications.add("Tag PB cleared.", 0);
    } else {
      Notifications.add("Something went wrong: " + response.message, -1);
    }
    // console.log(`clearing for ${eval("this.parameters[0]")} ${eval("this.parameters[1]")}`);
  },
  (thisPopup) => {
    thisPopup.text = `Are you sure you want to clear PB for tag ${thisPopup.parameters[1]}?`;
  }
);

list["applyCustomFont"] = new SimplePopup(
  "applyCustomFont",
  "text",
  "Custom font",
  [{ placeholder: "Font name", initVal: "" }],
  "Make sure you have the font installed on your computer before applying.",
  "Apply",
  (_thisPopup, fontName: string) => {
    if (fontName === "") return;
    Settings.groups["fontFamily"]?.setValue(fontName.replace(/\s/g, "_"));
  },
  () => {
    //
  }
);

list["resetPersonalBests"] = new SimplePopup(
  "resetPersonalBests",
  "text",
  "Reset Personal Bests",
  [
    {
      placeholder: "Password",
      type: "password",
      initVal: "",
    },
  ],
  "",
  "Reset",
  async (_thisPopup, password: string) => {
    try {
      const user = firebase.auth().currentUser;
      if (user.providerData[0].providerId === "password") {
        const credential = firebase.auth.EmailAuthProvider.credential(
          user.email,
          password
        );
        await user.reauthenticateWithCredential(credential);
      } else if (user.providerData[0].providerId === "google.com") {
        await user.reauthenticateWithPopup(AccountController.gmailProvider);
      }
      Loader.show();
      const response = await Ape.users.deletePersonalBests();
      Loader.hide();

      if (response.status !== 200) {
        return Notifications.add(
          "Failed to reset personal bests: " + response.message,
          -1
        );
      }

      Notifications.add("Personal bests have been reset", 1);
      DB.getSnapshot().personalBests = {
        time: {},
        words: {},
        zen: { zen: [] },
        quote: { custom: [] },
        custom: { custom: [] },
      };
    } catch (e) {
      Loader.hide();
      Notifications.add(e as string, -1);
    }
  },
  (thisPopup) => {
    const user = firebase.auth().currentUser;
    if (user.providerData[0].providerId === "google.com") {
      thisPopup.inputs = [];
      thisPopup.buttonText = "Reauthenticate to reset";
    }
  }
);

list["resetSettings"] = new SimplePopup(
  "resetSettings",
  "text",
  "Reset Settings",
  [],
  "Are you sure you want to reset all your settings?",
  "Reset",
  () => {
    UpdateConfig.reset();
    // setTimeout(() => {
    //   location.reload();
    // }, 1000);
  },
  () => {
    //
  }
);

list["unlinkDiscord"] = new SimplePopup(
  "unlinkDiscord",
  "text",
  "Unlink Discord",
  [],
  "Are you sure you want to unlink your Discord account?",
  "Unlink",
  async () => {
    Loader.show();
    const response = await Ape.users.unlinkDiscord();
    Loader.hide();

    if (response.status !== 200) {
      return Notifications.add(
        "Failed to unlink Discord: " + response.message,
        -1
      );
    }

    Notifications.add("Accounts unlinked", 1);
    DB.getSnapshot().discordId = undefined;
    Settings.updateDiscordSection();
  },
  () => {
    //
  }
);

$(".pageSettings .section.discordIntegration #unlinkDiscordButton").click(
  () => {
    list["unlinkDiscord"].show();
  }
);

$("#resetSettingsButton").click(() => {
  list["resetSettings"].show();
});

$(".pageSettings #resetPersonalBestsButton").on("click", () => {
  list["resetPersonalBests"].show();
});

$(".pageSettings #updateAccountName").on("click", () => {
  list["updateName"].show();
});

$(".pageSettings #addPasswordAuth").on("click", () => {
  list["addPasswordAuth"].show();
});

$(".pageSettings #emailPasswordAuth").on("click", () => {
  list["updateEmail"].show();
});

$(".pageSettings #passPasswordAuth").on("click", () => {
  list["updatePassword"].show();
});

$(".pageSettings #deleteAccount").on("click", () => {
  list["deleteAccount"].show();
});

$(document).on(
  "click",
  ".pageSettings .section.fontFamily .button.custom",
  () => {
    list["applyCustomFont"].show([]);
  }
);

$(document).keydown((event) => {
  if (event.key === "Escape" && !$("#simplePopupWrapper").hasClass("hidden")) {
    hide();
    event.preventDefault();
  }
});