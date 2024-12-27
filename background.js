let isPopupOpen = false

chrome.commands.onCommand.addListener(
  async (command) => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })

    const items = await chrome.readingList.query(
      {}
    )
    const url = activeTab?.url

    const updateStorage = (type, message) => {
      chrome.storage.local.set({
        lastStatus: { type, message },
      })
    }
    //Kind of a janky workaround, but it works. Previously, it was closing the popup every time that the listener was called, and because I wanted to keep the html as an interface for people who don't prefer the keyboard shortcuts, I had to find a way to keep the popup open (or in this case, to call it back to the foreground after 2 seconds). I'm sure there's a better way to do this, but I'm not sure what it is at the moment. And... it's just not that important. I'll take a deeper dive into chrome's readlist API at some point in the future if/when I have time and need to. If anyone has any suggestions, please let me know.
    // TODO: Find a way to keep the popup open/to bypass chrome's popup default popup closing behavior
    const showPopup = (type, message) => {
      if (isPopupOpen) {
        console.log("Popup is already open")
        setTimeout(() => {
          updateStorage(type, message)
          chrome.action.openPopup()
        }, 200)
      } else {
        console.log("Showing popup")
        updateStorage(type, message)
        chrome.action.openPopup()
        isPopupOpen = true
      }
    }

    const showSuccess = (message) =>
      showPopup("success", message)
    const showError = (message) =>
      showPopup("error", message)

    //-------- Start of actual code --------
    if (!activeTab?.title || !activeTab?.url) {
      showError(
        "No active tab found or tab lacks title and URL."
      )
      return
    }

    try {
      //-------- Add to/Remove from Reading List --------
      if (command === "add_to_reading_list") {
        const existingItem = items.find(
          (item) => item.url === url
        )

        if (existingItem) {
          await chrome.readingList.removeEntry({
            url,
          })
          showSuccess(
            `Removed "${activeTab.title}" from your Reading List ❌`
          )
        } else {
          await chrome.readingList.addEntry({
            title: activeTab.title,
            url,
            hasBeenRead: false,
          })
          showSuccess(
            `Added "${activeTab.title}" to your Reading List ✅`
          )
        }

        //-------- Mark as Read/Unread --------
      } else if (command === "mark_as_read") {
        const item = items.find(
          (i) => i.url === url
        )

        if (!item) {
          showError(
            "The current tab is not in your Reading List 🤔"
          )
          return
        }

        const updatedStatus = !item.hasBeenRead
        await chrome.readingList.updateEntry({
          url,
          hasBeenRead: updatedStatus,
        })

        const statusText = updatedStatus
          ? "Read"
          : "Unread"
        showSuccess(
          `Marked "${activeTab.title}" as ${statusText} in your Reading List ✅`
        )
      }
      //-------- Catch errors --------
    } catch (error) {
      if (
        error.message.includes("Duplicate URL")
      ) {
        showError(
          `<b>${activeTab.title}</b> is already in your Reading List 😎`
        )
      } else if (
        error.message.includes("is not supported")
      ) {
        showError(
          `<b>Can't bookmark this page</b> 🤖`
        )
      } else {
        showError(
          "An unexpected error occurred 🚫"
        )
      }
    }
  }
)
