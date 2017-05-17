// Native
import { homedir } from 'os'

// Packages
import electron from 'electron'

// Utilities
import showError from './error'

const npmInstalled = async exec => {
  try {
    // Check if we're able to get the version of the local npm instance
    // If we're not, it's not installed
    await exec('npm -v', {
      cwd: homedir()
    })
  } catch (err) {
    return false
  }

  return true
}

const loadBundled = async (section, utils) => {
  const downloadURL = await utils.getURL()

  const onUpdate = progress => {
    section.setState({ progress })
  }

  let tempLocation

  try {
    tempLocation = await utils.download(
      downloadURL.url,
      downloadURL.binaryName,
      onUpdate
    )
  } catch (err) {
    if (err instanceof Error && err.name && err.name === 'offline') {
      throw new Error(err.message)
    }

    throw new Error('Could not download binary')
  }

  if (section) {
    section.setState({
      downloading: false
    })
  }

  try {
    await utils.handleExisting(tempLocation.path)
  } catch (err) {
    throw new Error('Not able to move binary')
  }

  return tempLocation
}

const stopInstallation = (section, reason, trace) => {
  section.setState({
    installing: false,
    done: false
  })

  showError(reason, trace)
}

export default async section => {
  const remote = electron.remote || false

  if (!remote) {
    return
  }

  const onlineStatus = remote.process.env.CONNECTION

  if (onlineStatus && onlineStatus === 'offline') {
    showError("Could not download binary. You're offline!")
    return
  }

  const utils = remote.require('./utils/binary')
  const notify = remote.require('./notify')

  if (section) {
    section.setState({
      installing: true,
      downloading: true
    })
  }

  const { exec } = remote.require('child-process-promise')
  const npmExists = await npmInstalled(exec)

  let tempLocation

  if (npmExists) {
    try {
      await exec('npm install -g now', {
        cwd: homedir()
      })
    } catch (err) {
      const message =
        'Not able to install the ' +
        'CLI using npm. Please ensure that ' +
        'the permissions are fixed: \n\n' +
        'https://docs.npmjs.com/getting-started/fixing-npm-permissions'

      stopInstallation(section, message, err)
      return
    }
  } else {
    // Prepare progress bar (make it show up)
    section.setState({
      progress: 0
    })

    try {
      tempLocation = await loadBundled(section, utils)
    } catch (err) {
      stopInstallation(section, err)
      return
    }
  }

  // Let the user know we're finished
  if (section) {
    section.setState({
      installing: false,
      done: true
    })
  }

  notify({
    title: 'Finished Installing now CLI',
    body: 'You can now use `now` from the command line.'
  })

  // Remove temporary directory
  if (tempLocation) {
    tempLocation.cleanup()
  }
}
