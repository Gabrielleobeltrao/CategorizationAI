function Register() {
    return(
        <section className="w-full h-dvh flex items-center justify-center">
            <div className="flex flex-col gap-4 w-1/3">
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="text"
                placeholder="Name"
            />
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="text"
                placeholder="Email"
            />
            <input
                className="border-2 border-gray-100 rounded-full px-3 py-2 placeholder:text-black"
                type="password"
                placeholder="Password"
            />
            <button 
                className="bg-gray-100 rounded-full p-2"
            >
                Create Account
            </button>
            </div>
        </section>
    )
}

export default Register