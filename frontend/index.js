import {$, $$, render, safe} from 'dat://pauls-uikit.hashbase.io/js/dom.js'

var backendUrl
main()

async function main () {
  // read backend info
  backendUrl = await (new DatArchive(window.location)).readFile('/backend.json')

  // attach form behavior
  $('#add-btn').addEventListener('click', onClickAdd)

  // render listing and refetch latest every 15 seconds
  fetchAndRenderListing()
  setInterval(fetchAndRenderListing, 15e3)
}

async function onClickAdd (e) {
  e.preventDefault()
  var btn = $('#add-btn')
  btn.setAttribute('disabled', true)

  // choose archive
  btn.textContent = 'Choosing archive...'
  var archive = await DatArchive.selectArchive({
    title: 'Select which site you want to submit',
    buttonLabel: 'Submit site'
  })
  var url = archive.url

  try {
    // load screenshot
    btn.textContent = 'Getting screenshot...'
    var thumbnail = await experimental.capturePage(url, {width: 1200, height: 800, resizeTo: {width: 300, height: 200}})
    thumbnail = btoa(String.fromCharCode(...new Uint8Array(thumbnail))) // base64 encode

    // submit
    btn.textContent = 'Submitting...'
    var res = await (await fetch(`${backendUrl}/dats`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url, thumbnail})})).json()
    if (res.success) {
      fetchAndRenderListing()
    } else {
      alert(res.error)
    }
  } catch (e) {
    console.error(e)
    alert(e.toString())
  }

  btn.removeAttribute('disabled')
  btn.textContent = 'Add a dat'
}

async function fetchAndRenderListing () {
  renderListing(await fetchListing())  
}

async function fetchListing () {
  var res = await fetch(`${backendUrl}/dats`)
  return (await res.json()).dats
}

function renderListing (listing) {
  var container = $('#listing')
  container.innerHTML = ''

  for (var key in listing) {
    let dat = listing[key]
    container.append(render(`
      <div class="dat">
        <img src="${backendUrl}/thumbs/${safe(key)}.png" />
        <div class="dat-title"><a href="${safe(dat.url)}" title="${safe(dat.title)}">${safe(dat.title)}</a></div>
        <div class="dat-description">${safe(dat.description)}</div>
      </div>
    `))
  }
}