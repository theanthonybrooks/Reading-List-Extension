document.addEventListener(
  "DOMContentLoaded",
  () => {
    const statusList =
      document.getElementById("statusList")
    const addToReadingListButton =
      document.getElementById("addToReadingList")
    const markAsReadButton =
      document.getElementById("markAsReadButton")

    let closeWindowTimeout

    const updateStatusList = (message, type) => {
      const listItem =
        document.createElement("li")
      listItem.innerHTML = message
      listItem.className = type
      statusList.innerHTML = ""
      statusList.appendChild(listItem)
    }

    const updateStorage = (type, message) => {
      chrome.storage.local.set({
        lastStatus: { type, message },
      })
    }

    const resetCloseWindowTimer = () => {
      if (closeWindowTimeout) {
        clearTimeout(closeWindowTimeout)
      }
      closeWindowTimeout = setTimeout(() => {
        window.close()
      }, 3000)
    }
    const handlePostAction = () => {
      addToReadingListButton.classList.add(
        "hidden"
      )
      markAsReadButton.classList.add("hidden")
      updateStorage("new", "start fresh")
      resetCloseWindowTimer()
    }

    const updateButtonStates = async () => {
      const [activeTab] = await chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        }
      )
      const url = activeTab?.url

      if (!activeTab?.title || !activeTab?.url) {
        return
      }

      const items =
        await chrome.readingList.query({})
      const matchingItem = items.find(
        (item) => item.url === url
      )

      if (matchingItem) {
        addToReadingListButton.innerText =
          "Remove from Reading List"
        markAsReadButton.innerText =
          matchingItem.hasBeenRead
            ? "Mark as Unread"
            : "Mark as Read"
      } else {
        addToReadingListButton.innerText =
          "Add to Reading List"
        markAsReadButton.classList.add("hidden")
      }
    }

    const handleAction = async (actionType) => {
      const [activeTab] = await chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        }
      )
      const url = activeTab?.url

      if (!activeTab?.title || !activeTab?.url) {
        updateStatusList(
          "No active tab found or tab lacks title and URL.",
          "error"
        )
        return
      }

      try {
        const items =
          await chrome.readingList.query({})
        const matchingItem = items.find(
          (item) => item.url === url
        )

        if (actionType === "add") {
          if (matchingItem) {
            await chrome.readingList.removeEntry({
              url: url,
            })
            const successMessage = `Removed "${activeTab.title}" from your Reading Lists ❌`
            updateStatusList(
              successMessage,
              "success"
            )
            updateStorage(
              "success",
              successMessage
            )
          } else {
            await chrome.readingList.addEntry({
              title: activeTab.title,
              url: url,
              hasBeenRead: false,
            })
            const successMessage = `Added "${activeTab.title}" to your Reading List ✅`
            updateStatusList(
              successMessage,
              "success"
            )
            updateStorage(
              "success",
              successMessage
            )
          }
        } else if (actionType === "mark") {
          if (matchingItem) {
            const updatedStatus =
              !matchingItem.hasBeenRead
            await chrome.readingList.updateEntry({
              url: url,
              hasBeenRead: updatedStatus,
            })
            const statusText = updatedStatus
              ? "Read"
              : "Unread"
            const successMessage = `Marked "${activeTab.title}" as ${statusText} in your Reading List ✅`
            updateStatusList(
              successMessage,
              "success"
            )
            updateStorage(
              "success",
              successMessage
            )
          } else {
            const errorMessage = `The current tab is not in your Reading List 🤔`
            updateStatusList(
              errorMessage,
              "error"
            )
            updateStorage("error", errorMessage)
          }
        }
      } catch (error) {
        if (actionType === "add") {
          if (
            error.message.includes(
              "Duplicate URL"
            )
          ) {
            const errorMessage = `<b>${activeTab.title}</b> is already in your Reading List 😎`
            updateStatusList(
              errorMessage,
              "error"
            )
            updateStorage("error", errorMessage)
          } else if (
            error.message.includes(
              "is not supported"
            )
          ) {
            const errorMessage = `<b>Can't bookmark this page</b> 🤖`
            updateStatusList(
              errorMessage,
              "error"
            )
            updateStorage("error", errorMessage)
          }
        }
      }

      handlePostAction()
      await updateButtonStates()
    }

    //-------- Essentially gathers the last status message and uses it to show/hide the buttons between popup loads -------- Also jank.
    chrome.storage.local.get(
      "lastStatus",
      (result) => {
        const lastStatus = result.lastStatus

        if (lastStatus.type !== "new") {
          updateStatusList(
            lastStatus.message,
            lastStatus.type
          )
          handlePostAction()
        } else {
          addToReadingListButton.classList.remove(
            "hidden"
          )
          markAsReadButton.classList.remove(
            "hidden"
          )
        }
      }
    )

    updateButtonStates()

    addToReadingListButton.addEventListener(
      "click",
      () => handleAction("add")
    )
    markAsReadButton.addEventListener(
      "click",
      () => handleAction("mark")
    )
  }
)
